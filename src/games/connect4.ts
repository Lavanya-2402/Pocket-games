import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

export const ROWS = 6;
export const COLS = 7;

export interface Connect4State {
  /** board[row][col], row 0 = top. Value = seat (0/1) or null. */
  board: (0 | 1 | null)[][];
  players: Players; // seat 0 goes first
  turn: 0 | 1;
  winner: Outcome;
  line: [number, number][] | null; // winning cells as [row, col]
  last: [number, number] | null; // most recent drop, for animation
}

export type Connect4Move = { col: number };

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

function lineThrough(board: Connect4State["board"], r: number, c: number): [number, number][] | null {
  const who = board[r][c];
  if (who === null) return null;
  for (const [dr, dc] of DIRS) {
    const cells: [number, number][] = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign, cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === who) {
        cells.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

/** Lowest empty row in a column, or -1 if full. */
export function dropRow(board: Connect4State["board"], col: number) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === null) return r;
  return -1;
}

// ---- Computer opponent: look a few moves ahead, scoring every window of four ----

type Board = Connect4State["board"];
const WINDOWS: [number, number][][] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of DIRS) {
      const cells = [0, 1, 2, 3].map((i) => [r + dr * i, c + dc * i] as [number, number]);
      if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS)) WINDOWS.push(cells);
    }
  }
}
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // try the middle first
const WON = 100000;

function evaluate(board: Board, me: 0 | 1) {
  let score = 0;
  for (const w of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const [r, c] of w) {
      if (board[r][c] === me) mine++;
      else if (board[r][c] !== null) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 4) return WON;
    if (theirs === 4) return -WON;
    score += mine === 3 ? 50 : mine === 2 ? 6 : mine;
    score -= theirs === 3 ? 60 : theirs === 2 ? 6 : theirs;
  }
  for (let r = 0; r < ROWS; r++) if (board[r][3] === me) score += 3;
  return score;
}

/** Best achievable score with `who` to move, from `me`'s point of view. */
function lookAhead(board: Board, who: 0 | 1, me: 0 | 1, depth: number, alpha: number, beta: number): number {
  const now = evaluate(board, me);
  if (Math.abs(now) >= WON) return now > 0 ? now + depth : now - depth; // prefer faster wins, slower losses
  if (depth === 0) return now;
  const cols = ORDER.filter((c) => board[0][c] === null);
  if (!cols.length) return 0;
  let best = who === me ? -Infinity : Infinity;
  for (const c of cols) {
    const r = dropRow(board, c);
    board[r][c] = who;
    const v = lookAhead(board, who === 0 ? 1 : 0, me, depth - 1, alpha, beta);
    board[r][c] = null;
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

export function bestColumn(board: Board, me: 0 | 1, depth: number, rng: () => number) {
  const copy = board.map((row) => [...row]);
  const scored = ORDER.filter((c) => copy[0][c] === null).map((c) => {
    const r = dropRow(copy, c);
    copy[r][c] = me;
    const v = lookAhead(copy, me === 0 ? 1 : 0, me, depth - 1, -Infinity, Infinity);
    copy[r][c] = null;
    return [c, v] as const;
  });
  const best = Math.max(...scored.map(([, v]) => v));
  return pick(scored.filter(([, v]) => v === best).map(([c]) => c), rng);
}

export const connect4: GameEngine<Connect4State, Connect4Move> = {
  id: "connect4",
  name: "Connect Four",
  moveSchema: z.object({ col: z.number().int().min(0).max(COLS - 1) }),

  init(players) {
    return {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      players,
      turn: 0,
      winner: null,
      line: null,
      last: null,
    };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (dropRow(s.board, move.col) === -1) return "Column is full";
    return null;
  },

  apply(s, move) {
    const r = dropRow(s.board, move.col);
    const board = s.board.map((row) => [...row]);
    board[r][move.col] = s.turn;
    const line = lineThrough(board, r, move.col);
    const winner: Outcome = line
      ? s.players[s.turn]
      : board[0].every((c) => c !== null)
        ? "draw"
        : null;
    return { ...s, board, line, winner, last: [r, move.col], turn: s.turn === 0 ? 1 : 0 };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s,
  timeLimit: () => 30,
  autoMove(s, _p, rng) {
    const open = Array.from({ length: COLS }, (_, c) => c).filter((c) => dropRow(s.board, c) !== -1);
    return { col: open[Math.floor(rng() * open.length)] };
  },
  // Hard looks 5 moves ahead. Easy looks 2 ahead and sometimes just plays anywhere.
  botMove(s, _p, rng, level) {
    const open = Array.from({ length: COLS }, (_, c) => c).filter((c) => dropRow(s.board, c) !== -1);
    if (level === "easy" && rng() < 0.3) return { col: pick(open, rng) };
    return { col: bestColumn(s.board, s.turn, level === "hard" ? 5 : 2, rng) };
  },
};
