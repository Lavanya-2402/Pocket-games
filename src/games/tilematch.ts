import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom } from "./util";

/**
 * Tile Match: everyone plays on the same board of coloured tiles. On your turn, swap
 * two neighbouring tiles to line up three or more; they clear, the tiles above fall,
 * new ones drop in, and any new lines clear too. Most points after the last turn wins.
 */

export const N = 7;
export const KINDS = 6;
/** Turns each player gets. */
export const TURNS = 8;
type Seat = number;
const at = (r: number, c: number) => r * N + c;

/** Every tile that is part of a line of three or more. Empty squares (-1) never match. */
export function matches(b: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = b[at(r, c)];
      if (k < 0) continue;
      if (c + 2 < N && b[at(r, c + 1)] === k && b[at(r, c + 2)] === k) for (let d = 0; d < 3; d++) out.add(at(r, c + d));
      if (r + 2 < N && b[at(r + 1, c)] === k && b[at(r + 2, c)] === k) for (let d = 0; d < 3; d++) out.add(at(r + d, c));
    }
  }
  return out;
}

export const adjacent = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return d === N || (d === 1 && Math.floor(a / N) === Math.floor(b / N));
};

export function makesMatch(b: readonly number[], x: number, y: number) {
  if (!adjacent(x, y) || b[x] === b[y]) return false;
  const t = [...b];
  [t[x], t[y]] = [t[y], t[x]];
  return matches(t).size > 0;
}

export function validSwaps(b: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < N * N; i++) {
    if (i % N < N - 1 && makesMatch(b, i, i + 1)) out.push([i, i + 1]);
    if (i + N < N * N && makesMatch(b, i, i + N)) out.push([i, i + N]);
  }
  return out;
}

/**
 * Clear lines, drop the tiles above, refill from the top, and repeat until nothing lines up.
 * Each tile is worth 1 point in the first clear, 2 in the second, and so on.
 * Without `rand` the gaps stay empty — that is how the computer looks ahead.
 */
export function settle(board: readonly number[], rand: (() => number) | null) {
  const b = [...board];
  let cleared = 0, pts = 0, combo = 0;
  for (;;) {
    const m = matches(b);
    if (!m.size) break;
    combo++;
    cleared += m.size;
    pts += m.size * combo;
    for (const i of m) b[i] = -1;
    for (let c = 0; c < N; c++) {
      const col: number[] = [];
      for (let r = N - 1; r >= 0; r--) if (b[at(r, c)] >= 0) col.push(b[at(r, c)]);
      for (let r = N - 1, k = 0; r >= 0; r--, k++) b[at(r, c)] = k < col.length ? col[k] : rand ? Math.floor(rand() * KINDS) : -1;
    }
  }
  return { board: b, cleared, pts, combo };
}

/** A full board with no lines yet and at least one swap that makes one. */
function fresh(rand: () => number): number[] {
  for (;;) {
    const b: number[] = [];
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N), c = i % N;
      let k: number;
      do k = Math.floor(rand() * KINDS);
      while ((c >= 2 && b[i - 1] === k && b[i - 2] === k) || (r >= 2 && b[i - N] === k && b[i - 2 * N] === k));
      b.push(k);
    }
    if (validSwaps(b).length) return b;
  }
}

export interface TileMatchState {
  players: Players;
  board: number[];
  scores: number[];
  turn: Seat;
  turnsLeft: number; // counting every player's turns
  seed: number; // RNG state — secret, or the tiles to come could be predicted
  last: { by: Seat; a: number; b: number; cleared: number; pts: number; combo: number; shuffled: boolean } | null;
  winner: Outcome;
}

export type TileMatchMove = { a: number; b: number };
export type TileMatchView = Omit<TileMatchState, "seed">;

export const tileMatch: GameEngine<TileMatchState, TileMatchMove> = {
  id: "tilematch",
  name: "Tile Match",
  hiddenInfo: true, // only the tiles still to come
  maxPlayers: 4,
  moveSchema: z.object({ a: z.number().int().min(0).max(N * N - 1), b: z.number().int().min(0).max(N * N - 1) }),

  init(players, seed) {
    const r = rngFrom(seed);
    const board = fresh(r.next);
    return { players, board, scores: players.map(() => 0), turn: 0, turnsLeft: TURNS * players.length, seed: r.seed(), last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (!adjacent(m.a, m.b)) return "Swap two tiles that are next to each other";
    if (!makesMatch(s.board, m.a, m.b)) return "That swap doesn't line up three";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const r = rngFrom(s.seed);
    const swapped = [...s.board];
    [swapped[m.a], swapped[m.b]] = [swapped[m.b], swapped[m.a]];
    const done = settle(swapped, r.next);
    // No swap left anywhere? Deal a new board.
    const stuck = validSwaps(done.board).length === 0;
    const board = stuck ? fresh(r.next) : done.board;
    const scores = s.scores.map((v, i) => (i === me ? v + done.pts : v));
    const turnsLeft = s.turnsLeft - 1;
    let winner: Outcome = null;
    if (turnsLeft === 0) {
      const best = Math.max(...scores);
      winner = scores.filter((v) => v === best).length > 1 ? "draw" : s.players[scores.indexOf(best)];
    }
    return {
      ...s, board, scores, turnsLeft, winner, seed: r.seed(),
      turn: winner ? me : (me + 1) % s.players.length,
      last: { by: me, a: m.a, b: m.b, cleared: done.cleared, pts: done.pts, combo: done.combo, shuffled: stuck },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, _p, rng) {
    const [a, b] = pick(validSwaps(s.board), rng);
    return { a, b };
  },

  // Looks at what each swap clears from the tiles on show; it can't see what will drop in.
  botMove(s, _p, rng, level) {
    const swaps = validSwaps(s.board);
    if (level === "easy" && rng() < 0.6) {
      const [a, b] = pick(swaps, rng);
      return { a, b };
    }
    let best = swaps[0], bestPts = -1;
    for (const sw of swaps) {
      const t = [...s.board];
      [t[sw[0]], t[sw[1]]] = [t[sw[1]], t[sw[0]]];
      const { pts } = settle(t, null);
      if (pts > bestPts) [best, bestPts] = [sw, pts];
    }
    return { a: best[0], b: best[1] };
  },

  viewFor(s): TileMatchView {
    const { seed: _seed, ...rest } = s;
    void _seed;
    return rest;
  },
};
