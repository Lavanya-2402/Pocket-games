import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Territory: place a piece on any empty square; every opponent piece touching it
 * (including diagonally) flips to your colour. When the board is full, most squares wins.
 */

export const SIZE = 6;
type Seat = 0 | 1;

export interface TerritoryState {
  players: Players;
  board: (Seat | null)[]; // SIZE*SIZE, row-major
  turn: Seat;
  last: { cell: number; by: Seat; flipped: number[] } | null;
  winner: Outcome;
}

export type TerritoryMove = { cell: number };

/** Opponent pieces that would flip if `who` played at `cell`. */
export function flips(board: (Seat | null)[], cell: number, who: Seat) {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if ((dr || dc) && r >= 0 && c >= 0 && r < SIZE && c < SIZE && board[r * SIZE + c] === 1 - who) out.push(r * SIZE + c);
    }
  }
  return out;
}

export const count = (board: (Seat | null)[]) =>
  [0, 1].map((seat) => board.filter((x) => x === seat).length) as [number, number];

function play(board: (Seat | null)[], cell: number, who: Seat) {
  const next = [...board];
  const flipped = flips(board, cell, who);
  next[cell] = who;
  for (const i of flipped) next[i] = who;
  return { next, flipped };
}

export const territory: GameEngine<TerritoryState, TerritoryMove> = {
  id: "territory",
  name: "Territory",
  moveSchema: z.object({ cell: z.number().int().min(0).max(SIZE * SIZE - 1) }),

  init(players) {
    const board: (Seat | null)[] = Array(SIZE * SIZE).fill(null);
    // Each player starts with two opposite corners of the middle block.
    const m = SIZE / 2 - 1;
    board[m * SIZE + m] = 0;
    board[(m + 1) * SIZE + m + 1] = 0;
    board[m * SIZE + m + 1] = 1;
    board[(m + 1) * SIZE + m] = 1;
    return { players, board, turn: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.board[m.cell] !== null) return "That square is taken";
    return null;
  },

  apply(s, m) {
    const { next, flipped } = play(s.board, m.cell, s.turn);
    const [a, b] = count(next);
    const winner: Outcome = next.every((x) => x !== null) ? (a === b ? "draw" : s.players[a > b ? 0 : 1]) : null;
    return { ...s, board: next, winner, last: { cell: m.cell, by: s.turn, flipped }, turn: (1 - s.turn) as Seat };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s,
  timeLimit: () => 20,

  autoMove(s, p, rng) {
    return territory.botMove!(s, p, rng, "easy");
  },

  // Hard: best swing after the opponent's best reply. Easy: usually just the biggest flip.
  botMove(s, _p, rng, level) {
    const empty = s.board.flatMap((x, i) => (x === null ? [i] : []));
    if (level === "easy" && rng() < 0.35) return { cell: pick(empty, rng) };
    const me = s.turn, them = (1 - me) as Seat;
    const scored = empty.map((cell) => {
      const { next, flipped } = play(s.board, cell, me);
      let value = 1 + flipped.length * 2;
      if (level === "hard") {
        const replies = next.flatMap((x, i) => (x === null ? [flips(next, i, them).length * 2 + 1] : []));
        value -= replies.length ? Math.max(...replies) : 0;
      }
      return [cell, value] as const;
    });
    const best = Math.max(...scored.map(([, v]) => v));
    return { cell: pick(scored.filter(([, v]) => v === best).map(([c]) => c), rng) };
  },
};
