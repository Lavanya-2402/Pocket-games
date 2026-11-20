import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/** Five in a Row: tic tac toe on a big board. First to line up five stones wins. */

export const SIZE = 10;
export const NEED = 5;
type Seat = 0 | 1;

export interface FiveState {
  players: Players;
  board: (Seat | null)[]; // SIZE*SIZE, row-major
  turn: Seat;
  line: number[] | null;
  last: number | null;
  winner: Outcome;
}

export type FiveMove = { cell: number };

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
const at = (b: (Seat | null)[], r: number, c: number) =>
  r < 0 || c < 0 || r >= SIZE || c >= SIZE ? undefined : b[r * SIZE + c];

/** The run of same-coloured stones through a cell in one direction, as cell indexes. */
function run(b: (Seat | null)[], cell: number, [dr, dc]: [number, number], who: Seat) {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  const cells = [cell];
  for (const sign of [1, -1]) {
    let r = r0 + dr * sign, c = c0 + dc * sign;
    while (at(b, r, c) === who) {
      cells.push(r * SIZE + c);
      r += dr * sign;
      c += dc * sign;
    }
  }
  return cells;
}

function winningLine(b: (Seat | null)[], cell: number, who: Seat) {
  for (const d of DIRS) {
    const cells = run(b, cell, d, who);
    if (cells.length >= NEED) return cells;
  }
  return null;
}

/** How good is it for `who` to play at `cell`? Counts the lines it would make, and open ends. */
function strength(b: (Seat | null)[], cell: number, who: Seat) {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  let total = 0;
  for (const [dr, dc] of DIRS) {
    let len = 1, open = 0;
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign, c = c0 + dc * sign;
      while (at(b, r, c) === who) {
        len++;
        r += dr * sign;
        c += dc * sign;
      }
      if (at(b, r, c) === null) open++;
    }
    if (len >= NEED) total += 100000;
    else if (open > 0) total += [0, 1, 8, 60, 600][len] * (open === 2 ? 3 : 1);
  }
  return total;
}

export const five: GameEngine<FiveState, FiveMove> = {
  id: "five",
  name: "Five in a Row",
  moveSchema: z.object({ cell: z.number().int().min(0).max(SIZE * SIZE - 1) }),

  init(players) {
    return { players, board: Array(SIZE * SIZE).fill(null), turn: 0, line: null, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.board[m.cell] !== null) return "That spot is taken";
    return null;
  },

  apply(s, m) {
    const board = [...s.board];
    board[m.cell] = s.turn;
    const line = winningLine(board, m.cell, s.turn);
    const winner: Outcome = line ? s.players[s.turn] : board.every((x) => x !== null) ? "draw" : null;
    return { ...s, board, line, winner, last: m.cell, turn: (1 - s.turn) as Seat };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s,
  timeLimit: () => 30,

  autoMove(s, p, rng) {
    return five.botMove!(s, p, rng, "easy");
  },

  // Score every empty spot for attack (my lines) and defence (their lines); play the best.
  botMove(s, _p, rng, level) {
    const empty = s.board.flatMap((x, i) => (x === null ? [i] : []));
    if (empty.length === SIZE * SIZE) return { cell: Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2) };
    const me = s.turn, them = (1 - me) as Seat;
    const near = empty.filter((cell) => {
      const r = Math.floor(cell / SIZE), c = cell % SIZE;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const v = at(s.board, r + dr, c + dc);
        if (v === 0 || v === 1) return true;
      }
      return false;
    });
    const pool = near.length ? near : empty;
    if (level === "easy" && rng() < 0.25) return { cell: pick(pool, rng) };
    const scored = pool.map((cell) => {
      const attack = strength(s.board, cell, me);
      const defend = strength(s.board, cell, them);
      return [cell, attack * (level === "hard" ? 1.1 : 0.7) + defend] as const;
    });
    const best = Math.max(...scored.map(([, v]) => v));
    return { cell: pick(scored.filter(([, v]) => v === best).map(([c]) => c), rng) };
  },
};
