import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";

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
};
