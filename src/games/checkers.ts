import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Checkers (draughts) on an 8 × 8 board. Men move one square diagonally forward and
 * jump over an enemy piece to capture it; a capture must be taken, and a piece keeps
 * jumping while it can. A man that reaches the far row becomes a king and can move
 * both ways. Take every enemy piece, or leave them with no move, to win.
 *
 * A piece is a number: owner * 2 + (1 if king). The first player starts at the bottom
 * (rows 5-7) and moves up the board.
 */

export const SIZE = 8;
/** Moves in a row without a capture before the game is called a draw. */
export const QUIET_LIMIT = 40;
type Seat = 0 | 1;
export type Piece = number | null;
export const ownerOf = (p: number) => (p >> 1) as Seat;
export const isKing = (p: number) => (p & 1) === 1;

export interface CheckersMove {
  from: number;
  /** Every square the piece lands on, in order (more than one for a multi-jump). */
  path: number[];
}

export interface CheckersState {
  players: Players;
  board: Piece[];
  turn: Seat;
  quiet: number; // moves since the last capture
  last: { by: Seat; from: number; path: number[]; taken: number[]; crowned: boolean } | null;
  winner: Outcome;
}

const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE];
const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < SIZE && c < SIZE;
const dirsFor = (p: number) => {
  const fwd = ownerOf(p) === 0 ? -1 : 1;
  return isKing(p) ? [[fwd, -1], [fwd, 1], [-fwd, -1], [-fwd, 1]] : [[fwd, -1], [fwd, 1]];
};
const crownRow = (seat: number) => (seat === 0 ? 0 : SIZE - 1);

/** Every jump sequence this piece can make from `sq`, taken as far as it can go. */
function jumps(board: Piece[], sq: number, p: number, path: number[], out: number[][]) {
  const [r, c] = rc(sq);
  let more = false;
  for (const [dr, dc] of dirsFor(p)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (!inside(lr, lc)) continue;
    const mid = mr * SIZE + mc, land = lr * SIZE + lc;
    const victim = board[mid];
    if (victim === null || ownerOf(victim) === ownerOf(p) || board[land] !== null) continue;
    more = true;
    // A man that reaches the far row is crowned and stops there.
    if (!isKing(p) && lr === crownRow(ownerOf(p))) {
      out.push([...path, land]);
      continue;
    }
    board[sq] = null;
    board[mid] = null;
    board[land] = p;
    jumps(board, land, p, [...path, land], out);
    board[sq] = p;
    board[mid] = victim;
    board[land] = null;
  }
  if (!more && path.length) out.push(path);
}

/** All legal moves for a seat. If any capture exists, only captures are legal. */
export function legalMoves(board: readonly Piece[], seat: number): CheckersMove[] {
  const b = [...board];
  const caps: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  b.forEach((p, sq) => {
    if (p === null || ownerOf(p) !== seat) return;
    const found: number[][] = [];
    jumps(b, sq, p, [], found);
    for (const path of found) caps.push({ from: sq, path });
    if (caps.length) return;
    const [r, c] = rc(sq);
    for (const [dr, dc] of dirsFor(p)) {
      if (inside(r + dr, c + dc) && b[(r + dr) * SIZE + c + dc] === null) steps.push({ from: sq, path: [(r + dr) * SIZE + c + dc] });
    }
  });
  return caps.length ? caps : steps;
}

/** Carry out a move on a copy of the board. */
export function carry(board: readonly Piece[], m: CheckersMove) {
  const b = [...board];
  let p = b[m.from]!;
  const taken: number[] = [];
  let at = m.from;
  b[at] = null;
  for (const to of m.path) {
    if (Math.abs(Math.floor(to / SIZE) - Math.floor(at / SIZE)) === 2) {
      const mid = (at + to) / 2;
      taken.push(mid);
      b[mid] = null;
    }
    at = to;
  }
  const crowned = !isKing(p) && Math.floor(at / SIZE) === crownRow(ownerOf(p));
  if (crowned) p |= 1;
  b[at] = p;
  return { board: b, taken, crowned };
}

const same = (a: CheckersMove, b: CheckersMove) => a.from === b.from && a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]);

function material(board: readonly Piece[], me: number) {
  let v = 0;
  board.forEach((p, i) => {
    if (p === null) return;
    const seat = ownerOf(p);
    // A man is worth more the closer it is to being crowned.
    const advance = seat === 0 ? SIZE - 1 - Math.floor(i / SIZE) : Math.floor(i / SIZE);
    const worth = isKing(p) ? 17 : 10 + advance * 0.4;
    v += seat === me ? worth : -worth;
  });
  return v;
}

function search(board: readonly Piece[], me: number, mover: number, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, mover);
  if (!moves.length) return mover === me ? -1000 - depth : 1000 + depth;
  if (depth === 0) return material(board, me);
  let best = mover === me ? -Infinity : Infinity;
  for (const m of moves) {
    const v = search(carry(board, m).board, me, 1 - mover, depth - 1, alpha, beta);
    if (mover === me) {
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

export const checkers: GameEngine<CheckersState, CheckersMove> = {
  id: "checkers",
  name: "Checkers",
  moveSchema: z.object({
    from: z.number().int().min(0).max(SIZE * SIZE - 1),
    path: z.array(z.number().int().min(0).max(SIZE * SIZE - 1)).min(1).max(12),
  }),

  init(players) {
    const board: Piece[] = Array(SIZE * SIZE).fill(null);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 0) continue; // pieces live on the dark squares
        if (r < 3) board[r * SIZE + c] = 2;
        if (r > 4) board[r * SIZE + c] = 0;
      }
    }
    return { players, board, turn: 0, quiet: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    const moves = legalMoves(s.board, seat);
    if (moves.some((x) => same(x, m))) return null;
    return moves[0]?.path.length && Math.abs(Math.floor(moves[0].path[0] / SIZE) - Math.floor(moves[0].from / SIZE)) === 2
      ? "You must capture when you can, and finish the whole jump"
      : "That piece can't move there";
  },

  apply(s, m) {
    const me = s.turn;
    const them = (1 - me) as Seat;
    const { board, taken, crowned } = carry(s.board, m);
    const quiet = taken.length ? 0 : s.quiet + 1;
    let winner: Outcome = null;
    if (!legalMoves(board, them).length) winner = s.players[me]; // no pieces, or none that can move
    else if (quiet >= QUIET_LIMIT) winner = "draw";
    return { ...s, board, quiet, winner, turn: winner ? me : them, last: { by: me, from: m.from, path: m.path, taken, crowned } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 45,

  autoMove: (s, playerId, rng) => pick(legalMoves(s.board, s.players.indexOf(playerId)), rng),

  botMove(s, playerId, rng, level) {
    const me = s.players.indexOf(playerId);
    const moves = legalMoves(s.board, me);
    if (level === "easy" && rng() < 0.4) return pick(moves, rng);
    const depth = level === "hard" ? 4 : 1;
    let best: CheckersMove[] = [], bestV = -Infinity;
    for (const m of moves) {
      const v = search(carry(s.board, m).board, me, 1 - me, depth, -Infinity, Infinity);
      if (v > bestV) [best, bestV] = [[m], v];
      else if (v === bestV) best.push(m);
    }
    return pick(best, rng);
  },

  viewFor: (s) => s,
};
