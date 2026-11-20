import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Mancala (Kalah rules). Pick up all the stones in one of your pits and sow them one
 * by one, anticlockwise. Finish in your own store and you go again; finish in an empty
 * pit of your own and you capture what is opposite. Most stones in the store wins.
 *
 * `pits` has 14 slots: 0-5 the first player's pits, 6 their store, 7-12 the second
 * player's pits, 13 their store.
 */

export const PITS = 6;
export const STONES = 4;
type Seat = 0 | 1;
const store = (seat: number) => (seat === 0 ? 6 : 13);
const side = (pits: readonly number[], seat: number) => pits.slice(seat * 7, seat * 7 + PITS).reduce((a, b) => a + b, 0);

export interface MancalaState {
  players: Players;
  pits: number[];
  turn: Seat;
  last: { by: Seat; pit: number; again: boolean; captured: number } | null;
  winner: Outcome;
}

export type MancalaMove = { pit: number }; // 0-5, counted from the mover's left

/** Sow from one pit. Returns the new pits, and what happened. */
export function sow(pits: readonly number[], seat: number, pit: number) {
  const p = [...pits];
  let i = seat * 7 + pit;
  let n = p[i];
  p[i] = 0;
  while (n > 0) {
    i = (i + 1) % 14;
    if (i === store(1 - seat)) continue; // never into the other player's store
    p[i]++;
    n--;
  }
  const again = i === store(seat);
  let captured = 0;
  if (!again && Math.floor(i / 7) === seat && p[i] === 1 && p[12 - i] > 0) {
    captured = p[12 - i] + 1;
    p[store(seat)] += captured;
    p[12 - i] = 0;
    p[i] = 0;
  }
  // When either side is empty, the stones left on the other side go to their owner.
  const over = side(p, 0) === 0 || side(p, 1) === 0;
  if (over) {
    for (const s of [0, 1]) {
      p[store(s)] += side(p, s);
      for (let k = 0; k < PITS; k++) p[s * 7 + k] = 0;
    }
  }
  return { pits: p, again: again && !over, captured, over };
}

const options = (pits: readonly number[], seat: number) => Array.from({ length: PITS }, (_, i) => i).filter((i) => pits[seat * 7 + i] > 0);

/** How good a position is for `seat`, looking `depth` sowings ahead. */
function search(pits: readonly number[], seat: number, mover: number, depth: number, alpha: number, beta: number): number {
  const opts = options(pits, mover);
  if (depth === 0 || !opts.length) return pits[store(seat)] - pits[store(1 - seat)];
  const mine = mover === seat;
  let best = mine ? -Infinity : Infinity;
  for (const pit of opts) {
    const r = sow(pits, mover, pit);
    const v = r.over
      ? r.pits[store(seat)] - r.pits[store(1 - seat)]
      : search(r.pits, seat, r.again ? mover : 1 - mover, depth - 1, alpha, beta);
    if (mine) {
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

export const mancala: GameEngine<MancalaState, MancalaMove> = {
  id: "mancala",
  name: "Mancala",
  moveSchema: z.object({ pit: z.number().int().min(0).max(PITS - 1) }),

  init(players) {
    const row = Array(PITS).fill(STONES);
    return { players, pits: [...row, 0, ...row, 0], turn: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.pits[seat * 7 + m.pit] === 0) return "That pit is empty";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const r = sow(s.pits, me, m.pit);
    let winner: Outcome = null;
    if (r.over) winner = r.pits[6] === r.pits[13] ? "draw" : s.players[r.pits[6] > r.pits[13] ? 0 : 1];
    return {
      ...s, pits: r.pits, winner,
      turn: r.again || r.over ? me : ((1 - me) as Seat),
      last: { by: me, pit: m.pit, again: r.again, captured: r.captured },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove: (s, playerId, rng) => ({ pit: pick(options(s.pits, s.players.indexOf(playerId)), rng) }),

  botMove(s, playerId, rng, level) {
    const me = s.players.indexOf(playerId);
    const opts = options(s.pits, me);
    if (level === "easy" && rng() < 0.5) return { pit: pick(opts, rng) };
    const depth = level === "hard" ? 6 : 2;
    let best: number[] = [], bestV = -Infinity;
    for (const pit of opts) {
      const r = sow(s.pits, me, pit);
      const v = r.over ? r.pits[store(me)] - r.pits[store(1 - me)] : search(r.pits, me, r.again ? me : 1 - me, depth, -Infinity, Infinity);
      if (v > bestV) [best, bestV] = [[pit], v];
      else if (v === bestV) best.push(pit);
    }
    return { pit: pick(best, rng) };
  },

  viewFor: (s) => s,
};
