import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom, shuffle } from "./util";

/**
 * Minefield Duel: one shared minefield. Take turns opening a square.
 * Here mines are good: find one and you score it and go again. A safe square shows
 * how many mines touch it, and your turn ends. First to find most of the mines wins.
 */

export const SIZE = 8;
export const MINES = 13; // odd, so somebody always wins
export const TARGET = Math.ceil(MINES / 2);
type Seat = 0 | 1;
/** null = unopened, 0-8 = safe with that many neighbouring mines, 10/11 = mine found by seat 0/1. */
export type Cell = number | null;

export interface MinefieldState {
  players: Players;
  mines: boolean[]; // secret
  cells: Cell[];
  found: [number, number];
  turn: Seat;
  last: { by: Seat; cell: number; mine: boolean } | null;
  winner: Outcome;
}

export type MinefieldMove = { cell: number };

export type MinefieldView = Omit<MinefieldState, "mines"> & {
  /** Where the mines were — only once the game is over. */
  mines: boolean[] | null;
};

export function neighbours(cell: number) {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if ((dr || dc) && r >= 0 && c >= 0 && r < SIZE && c < SIZE) out.push(r * SIZE + c);
    }
  }
  return out;
}

const isMineCell = (v: Cell) => v !== null && v >= 10;

export const minefield: GameEngine<MinefieldState, MinefieldMove> = {
  id: "minefield",
  name: "Minefield Duel",
  hiddenInfo: true,
  moveSchema: z.object({ cell: z.number().int().min(0).max(SIZE * SIZE - 1) }),

  init(players, seed) {
    const spots = shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i), rngFrom(seed).next).slice(0, MINES);
    const mines = Array(SIZE * SIZE).fill(false);
    for (const i of spots) mines[i] = true;
    return { players, mines, cells: Array(SIZE * SIZE).fill(null), found: [0, 0], turn: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.cells[m.cell] !== null) return "That square is already open";
    return null;
  },

  apply(s, m) {
    const cells = [...s.cells];
    const me = s.turn;
    if (s.mines[m.cell]) {
      cells[m.cell] = 10 + me;
      const found: [number, number] = [...s.found];
      found[me]++;
      const winner: Outcome = found[me] >= TARGET ? s.players[me] : null;
      return { ...s, cells, found, winner, last: { by: me, cell: m.cell, mine: true } }; // same player goes again
    }
    // Safe: show the count, and open outward from empty squares.
    const queue = [m.cell];
    while (queue.length) {
      const i = queue.pop()!;
      if (cells[i] !== null) continue;
      const n = neighbours(i).filter((j) => s.mines[j]).length;
      cells[i] = n;
      if (n === 0) queue.push(...neighbours(i).filter((j) => cells[j] === null));
    }
    return { ...s, cells, turn: (1 - me) as Seat, last: { by: me, cell: m.cell, mine: false } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 20,
  botPace: "step", // show each square the computer opens

  autoMove(s, _p, rng) {
    return { cell: pick(s.cells.flatMap((v, i) => (v === null ? [i] : [])), rng) };
  },

  // Works only from what is visible: numbers tell it where mines must be.
  botMove(s, _p, rng, level) {
    const hidden = s.cells.flatMap((v, i) => (v === null ? [i] : []));
    if (level === "easy" && rng() < 0.5) return { cell: pick(hidden, rng) };
    const chance = new Map<number, number>(); // best known odds that a hidden square is a mine
    s.cells.forEach((v, i) => {
      if (v === null || v >= 10 || v === 0) return;
      const around = neighbours(i);
      const unknown = around.filter((j) => s.cells[j] === null);
      if (!unknown.length) return;
      const left = v - around.filter((j) => isMineCell(s.cells[j])).length;
      const p = left / unknown.length;
      // A square next to a satisfied number (p = 0) is certainly safe: remember that too.
      for (const j of unknown) chance.set(j, p === 0 ? 0 : chance.get(j) === 0 ? 0 : Math.max(chance.get(j) ?? 0, p));
    });
    const sure = hidden.filter((i) => chance.get(i) === 1);
    if (sure.length) return { cell: pick(sure, rng) };
    const minesLeft = MINES - s.found[0] - s.found[1];
    const baseline = minesLeft / hidden.length;
    const odds = (i: number) => chance.get(i) ?? baseline;
    const best = Math.max(...hidden.map(odds));
    return { cell: pick(hidden.filter((i) => odds(i) === best), rng) };
  },

  viewFor(s): MinefieldView {
    const { mines, ...rest } = s;
    return { ...rest, mines: s.winner ? mines : null };
  },
};
