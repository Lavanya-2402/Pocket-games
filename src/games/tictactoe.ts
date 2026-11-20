import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

export type Mark = "X" | "O";

export interface TicTacToeState {
  board: (Mark | null)[]; // 9 cells, row-major
  players: Players; // players[0] = X, players[1] = O
  turn: 0 | 1;
  winner: Outcome;
  line: number[] | null; // winning cells, for highlighting
}

export type TicTacToeMove = { cell: number };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findLine(board: (Mark | null)[]): number[] | null {
  for (const l of LINES) {
    const [a, b, c] = l;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return l;
  }
  return null;
}

export const ticTacToe: GameEngine<TicTacToeState, TicTacToeMove> = {
  id: "tictactoe",
  name: "Tic Tac Toe",
  moveSchema: z.object({ cell: z.number().int().min(0).max(8) }),

  init(players) {
    return { board: Array(9).fill(null), players, turn: 0, winner: null, line: null };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.board[move.cell] !== null) return "Cell already taken";
    return null;
  },

  apply(s, move) {
    const board = [...s.board];
    board[move.cell] = s.turn === 0 ? "X" : "O";
    const line = findLine(board);
    const winner: Outcome = line
      ? s.players[s.turn]
      : board.every(Boolean)
        ? "draw"
        : null;
    return { ...s, board, line, winner, turn: s.turn === 0 ? 1 : 0 };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s, // nothing hidden
  timeLimit: () => 20,
  autoMove(s, _p, rng) {
    const open = s.board.flatMap((c, i) => (c === null ? [i] : []));
    return { cell: open[Math.floor(rng() * open.length)] };
  },
  // Hard never loses (full search). Easy plays the best move only some of the time.
  botMove(s, _p, rng, level) {
    const open = s.board.flatMap((c, i) => (c === null ? [i] : []));
    if (level === "easy" && rng() < 0.6) return { cell: pick(open, rng) };
    const me: Mark = s.turn === 0 ? "X" : "O";
    const other = (m: Mark): Mark => (m === "X" ? "O" : "X");
    // Score from the bot's point of view; quicker wins and slower losses score better.
    const seen = new Map<string, number>(); // positions repeat a lot; remember them
    const search = (board: (Mark | null)[], who: Mark, depth: number): number => {
      const line = findLine(board);
      if (line) return board[line[0]] === me ? 10 - depth : depth - 10;
      const free = board.flatMap((c, i) => (c === null ? [i] : []));
      if (!free.length) return 0;
      const key = board.map((c) => c ?? "-").join("");
      const known = seen.get(key);
      if (known !== undefined) return known;
      const scores = free.map((i) => {
        board[i] = who;
        const v = search(board, other(who), depth + 1);
        board[i] = null;
        return v;
      });
      const best = who === me ? Math.max(...scores) : Math.min(...scores);
      seen.set(key, best);
      return best;
    };
    const board = [...s.board];
    const scored = open.map((i) => {
      board[i] = me;
      const v = search(board, other(me), 1);
      board[i] = null;
      return [i, v] as const;
    });
    const best = Math.max(...scored.map(([, v]) => v));
    return { cell: pick(scored.filter(([, v]) => v === best).map(([i]) => i), rng) };
  },
};
