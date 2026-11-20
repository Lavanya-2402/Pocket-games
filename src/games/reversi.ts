import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Reversi: place a disc so that one or more straight lines of the other colour are
 * trapped between it and another of your discs; the trapped discs flip to your colour.
 * No legal move means you miss your turn. Most discs at the end wins.
 */

export const SIZE = 8;
type Seat = 0 | 1;
export type Cell = Seat | null;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export interface ReversiState {
  players: Players;
  board: Cell[];
  turn: Seat;
  last: { by: Seat; cell: number; flipped: number[]; skipped: boolean } | null;
  winner: Outcome;
}

export type ReversiMove = { cell: number };

/** The discs that would flip if `who` played on `cell` (empty = not a legal move). */
export function flips(board: readonly Cell[], cell: number, who: number): number[] {
  if (board[cell] !== null) return [];
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && c >= 0 && r < SIZE && c < SIZE && board[r * SIZE + c] === 1 - who) {
      line.push(r * SIZE + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && c >= 0 && r < SIZE && c < SIZE && board[r * SIZE + c] === who) out.push(...line);
  }
  return out;
}

export const legal = (board: readonly Cell[], who: number) =>
  board.flatMap((v, i) => (v === null && flips(board, i, who).length ? [i] : []));
export const count = (board: readonly Cell[]) => [board.filter((v) => v === 0).length, board.filter((v) => v === 1).length];

function place(board: readonly Cell[], cell: number, who: Seat) {
  const flipped = flips(board, cell, who);
  const next = [...board];
  next[cell] = who;
  for (const i of flipped) next[i] = who;
  return { next, flipped };
}

/** Corners are precious; the squares next to them give corners away. */
const WEIGHT = (() => {
  const w = Array(SIZE * SIZE).fill(1);
  const edge = (i: number) => i === 0 || i === SIZE - 1;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const nearR = r === 1 || r === SIZE - 2, nearC = c === 1 || c === SIZE - 2;
      if (edge(r) && edge(c)) w[r * SIZE + c] = 30;
      else if ((edge(r) || nearR) && (edge(c) || nearC)) w[r * SIZE + c] = -8;
      else if (edge(r) || edge(c)) w[r * SIZE + c] = 5;
    }
  }
  return w;
})();

function score(board: readonly Cell[], me: number) {
  let v = 0;
  board.forEach((x, i) => {
    if (x !== null) v += x === me ? WEIGHT[i] : -WEIGHT[i];
  });
  return v + 3 * (legal(board, me).length - legal(board, 1 - me).length);
}

function search(board: readonly Cell[], me: Seat, mover: Seat, depth: number, alpha: number, beta: number): number {
  let moves = legal(board, mover);
  let who = mover;
  if (!moves.length) {
    who = (1 - mover) as Seat;
    moves = legal(board, who);
    if (!moves.length) {
      const [a, b] = count(board);
      return (me === 0 ? a - b : b - a) * 100; // game over: only the disc count matters
    }
  }
  if (depth === 0) return score(board, me);
  let best = who === me ? -Infinity : Infinity;
  for (const cell of moves) {
    const v = search(place(board, cell, who).next, me, (1 - who) as Seat, depth - 1, alpha, beta);
    if (who === me) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return best;
}

export const reversi: GameEngine<ReversiState, ReversiMove> = {
  id: "reversi",
  name: "Reversi",
  moveSchema: z.object({ cell: z.number().int().min(0).max(SIZE * SIZE - 1) }),

  init(players) {
    const board: Cell[] = Array(SIZE * SIZE).fill(null);
    const m = SIZE / 2;
    board[(m - 1) * SIZE + m - 1] = 1;
    board[m * SIZE + m] = 1;
    board[(m - 1) * SIZE + m] = 0;
    board[m * SIZE + m - 1] = 0;
    return { players, board, turn: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.board[m.cell] !== null) return "That square is taken";
    if (!flips(s.board, m.cell, seat).length) return "A move must trap at least one of their discs";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const them = (1 - me) as Seat;
    const { next, flipped } = place(s.board, m.cell, me);
    const theyCan = legal(next, them).length > 0;
    const iCan = legal(next, me).length > 0;
    let winner: Outcome = null;
    if (!theyCan && !iCan) {
      const [a, b] = count(next);
      winner = a === b ? "draw" : s.players[a > b ? 0 : 1];
    }
    return { ...s, board: next, winner, turn: theyCan || winner ? them : me, last: { by: me, cell: m.cell, flipped, skipped: !theyCan && !winner } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove: (s, playerId, rng) => ({ cell: pick(legal(s.board, s.players.indexOf(playerId)), rng) }),

  botMove(s, playerId, rng, level) {
    const me = s.players.indexOf(playerId) as Seat;
    const moves = legal(s.board, me);
    if (level === "easy") {
      // Grabs whatever flips the most right now.
      if (rng() < 0.3) return { cell: pick(moves, rng) };
      const most = Math.max(...moves.map((c) => flips(s.board, c, me).length));
      return { cell: pick(moves.filter((c) => flips(s.board, c, me).length === most), rng) };
    }
    let best: number[] = [], bestV = -Infinity;
    for (const cell of moves) {
      const v = search(place(s.board, cell, me).next, me, (1 - me) as Seat, 3, -Infinity, Infinity);
      if (v > bestV) [best, bestV] = [[cell], v];
      else if (v === bestV) best.push(cell);
    }
    return { cell: pick(best, rng) };
  },

  viewFor: (s) => s,
};
