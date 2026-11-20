import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Gravity Flip: Connect Four on a square board, with a twist — once per game each
 * player may spend their turn rotating the whole board a quarter turn. Every disc
 * then falls to the new bottom. Four in a row wins; if a flip lines up both
 * players at once, it's a draw.
 */

export const SIZE = 7;
type Seat = 0 | 1;
type Board = (Seat | null)[][]; // board[row][col], row 0 = top

export interface GravityState {
  players: Players;
  board: Board;
  turn: Seat;
  /** Flips each player has left. */
  flips: [number, number];
  /** How many flips have happened (drives the rotate animation). */
  flipCount: number;
  last: { by: Seat; type: "drop" | "flip"; cell: [number, number] | null } | null;
  line: [number, number][] | null;
  winner: Outcome;
}

export type GravityMove = { type: "drop"; col: number } | { type: "flip" };

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function dropRow(board: Board, col: number) {
  for (let r = SIZE - 1; r >= 0; r--) if (board[r][col] === null) return r;
  return -1;
}

/** Rotate a quarter turn clockwise, then let every disc fall. */
export function rotate(board: Board): Board {
  const turned: Board = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => board[SIZE - 1 - c][r]));
  const out: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let c = 0; c < SIZE; c++) {
    let row = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) if (turned[r][c] !== null) out[row--][c] = turned[r][c];
  }
  return out;
}

/** A line of four for `who`, if there is one. */
export function findLine(board: Board, who: Seat): [number, number][] | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of DIRS) {
        const cells = [0, 1, 2, 3].map((i) => [r + dr * i, c + dc * i] as [number, number]);
        if (cells.every(([rr, cc]) => rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === who)) return cells;
      }
    }
  }
  return null;
}

const full = (board: Board) => board[0].every((x) => x !== null);

export const gravity: GameEngine<GravityState, GravityMove> = {
  id: "gravity",
  name: "Gravity Flip",
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("drop"), col: z.number().int().min(0).max(SIZE - 1) }),
    z.object({ type: z.literal("flip") }),
  ]),

  init(players) {
    return {
      players,
      board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
      turn: 0, flips: [1, 1], flipCount: 0, last: null, line: null, winner: null,
    };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.type === "flip") return s.flips[seat] > 0 ? null : "You've already used your flip";
    return dropRow(s.board, m.col) === -1 ? "Column is full" : null;
  },

  apply(s, m) {
    const me = s.turn, them = (1 - me) as Seat;
    let board: Board;
    let cell: [number, number] | null = null;
    const flips: [number, number] = [...s.flips];
    if (m.type === "flip") {
      board = rotate(s.board);
      flips[me]--;
    } else {
      board = s.board.map((row) => [...row]);
      const r = dropRow(board, m.col);
      board[r][m.col] = me;
      cell = [r, m.col];
    }
    const mine = findLine(board, me), theirs = findLine(board, them);
    const winner: Outcome =
      mine && theirs ? "draw" : mine ? s.players[me] : theirs ? s.players[them] : full(board) ? "draw" : null;
    return {
      ...s, board, flips, winner,
      flipCount: s.flipCount + (m.type === "flip" ? 1 : 0),
      line: mine && theirs ? null : mine ?? theirs,
      last: { by: me, type: m.type, cell },
      turn: them,
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s,
  timeLimit: () => 30,

  autoMove(s, _p, rng) {
    const open = Array.from({ length: SIZE }, (_, c) => c).filter((c) => dropRow(s.board, c) !== -1);
    return { type: "drop", col: pick(open, rng) };
  },

  // Win if possible (by drop or flip), block an immediate loss, otherwise lean to the middle.
  botMove(s, _p, rng, level) {
    const me = s.turn, them = (1 - me) as Seat;
    const open = Array.from({ length: SIZE }, (_, c) => c).filter((c) => dropRow(s.board, c) !== -1);
    const after = (col: number, who: Seat) => {
      const b = s.board.map((row) => [...row]);
      b[dropRow(b, col)][col] = who;
      return b;
    };
    if (level === "easy" && rng() < 0.4) return { type: "drop", col: pick(open, rng) };
    const win = open.find((c) => findLine(after(c, me), me));
    if (win !== undefined) return { type: "drop", col: win };
    if (s.flips[me] > 0) {
      const turned = rotate(s.board);
      if (findLine(turned, me) && !findLine(turned, them)) return { type: "flip" };
    }
    const block = open.find((c) => findLine(after(c, them), them));
    if (block !== undefined) return { type: "drop", col: block };
    // Don't play a column that lets them win on top of it.
    const safe = open.filter((c) => {
      const b = after(c, me);
      return dropRow(b, c) === -1 || !findLine((() => { b[dropRow(b, c)][c] = them; return b; })(), them);
    });
    const pool = safe.length ? safe : open;
    const mid = (SIZE - 1) / 2;
    const closest = Math.min(...pool.map((c) => Math.abs(c - mid)));
    return { type: "drop", col: pick(pool.filter((c) => Math.abs(c - mid) <= closest + 1), rng) };
  },
};
