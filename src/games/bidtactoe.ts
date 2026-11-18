import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";

/**
 * Bid-Tac-Toe: tic tac toe with secret bidding.
 * Each round both players secretly lock in { bid, cell }. Higher bid places their
 * mark on their chosen cell and pays the bid to the opponent. Ties go to whoever
 * holds the tie-breaker, which then passes to the other player.
 */

export const START_COINS = 100;

export type Bid = { bid: number; cell: number };
export type Seat = 0 | 1;

export interface BidTacToeState {
  board: (Seat | null)[]; // 9 cells; seat 0 = ✕, seat 1 = ◯
  players: Players;
  coins: [number, number];
  tieHolder: Seat;
  pending: [Bid | null, Bid | null];
  round: number;
  last: { bids: [Bid, Bid]; won: Seat; tie: boolean } | null;
  winner: Outcome;
  line: number[] | null;
}

/** What a phone receives: the opponent's pending bid is masked. */
export type BidTacToeView = Omit<BidTacToeState, "pending"> & {
  pending: [Bid | "hidden" | null, Bid | "hidden" | null];
};

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findLine(board: (Seat | null)[]) {
  for (const l of LINES) {
    const [a, b, c] = l;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) return l;
  }
  return null;
}

export const bidTacToe: GameEngine<BidTacToeState, Bid> = {
  id: "bidtactoe",
  name: "Bid-Tac-Toe",
  hiddenInfo: true,
  moveSchema: z.object({
    bid: z.number().int().min(0).max(1000),
    cell: z.number().int().min(0).max(8),
  }),

  init(players, seed) {
    return {
      board: Array(9).fill(null),
      players,
      coins: [START_COINS, START_COINS],
      tieHolder: (seed % 2) as Seat,
      pending: [null, null],
      round: 1,
      last: null,
      winner: null,
      line: null,
    };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (s.pending[seat]) return "You already bid this round";
    if (move.bid > s.coins[seat]) return `You only have ${s.coins[seat]} coins`;
    if (s.board[move.cell] !== null) return "Cell already taken";
    return null;
  },

  apply(s, move, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    const pending: BidTacToeState["pending"] = [...s.pending];
    pending[seat] = move;
    const [a, b] = pending;
    if (!a || !b) return { ...s, pending };

    // Both bids are in: resolve the round.
    const tie = a.bid === b.bid;
    const won: Seat = tie ? s.tieHolder : a.bid > b.bid ? 0 : 1;
    const lost: Seat = won === 0 ? 1 : 0;
    const paid = pending[won]!.bid;
    const coins: [number, number] = [...s.coins];
    coins[won] -= paid;
    coins[lost] += paid;

    const board = [...s.board];
    board[pending[won]!.cell] = won;
    const line = findLine(board);
    const winner: Outcome = line ? s.players[won] : board.every((c) => c !== null) ? "draw" : null;

    return {
      ...s,
      board,
      coins,
      tieHolder: tie ? lost : s.tieHolder,
      pending: [null, null],
      round: s.round + 1,
      last: { bids: [a, b], won, tie },
      winner,
      line,
    };
  },

  winner: (s) => s.winner,
  turn: () => null, // simultaneous
  waitingOn: (s) => s.players.filter((_, i) => s.pending[i] === null),
  timeLimit: () => 30,
  autoMove(s, _p, rng) {
    // Out of time: bid nothing on a random open square.
    const open = s.board.flatMap((c, i) => (c === null ? [i] : []));
    return { bid: 0, cell: open[Math.floor(rng() * open.length)] };
  },
  viewFor(s, viewerId): BidTacToeView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const mask = (i: number) => (s.pending[i] === null ? null : i === me ? s.pending[i] : "hidden");
    return { ...s, pending: [mask(0), mask(1)] };
  },
};
