import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Matchsticks (the old game of Nim). Rows of sticks; on your turn take as many as you
 * like from ONE row. Whoever is forced to take the very last stick loses.
 */

export const ROWS = [1, 3, 5, 7];
type Seat = 0 | 1;

export interface MatchsticksState {
  players: Players;
  rows: number[];
  turn: Seat;
  last: { by: Seat; row: number; take: number } | null;
  winner: Outcome;
}

export type MatchsticksMove = { row: number; take: number };

/** Is this a position the player about to move can't win from (with best play)? */
export function losing(rows: readonly number[]) {
  // Once every row is down to one stick or none, an odd number of rows left means you take the last.
  if (rows.every((r) => r <= 1)) return rows.filter((r) => r === 1).length % 2 === 1;
  return rows.reduce((a, b) => a ^ b, 0) === 0;
}

const allMoves = (rows: readonly number[]) =>
  rows.flatMap((n, row) => Array.from({ length: n }, (_, i) => ({ row, take: i + 1 })));

export const matchsticks: GameEngine<MatchsticksState, MatchsticksMove> = {
  id: "matchsticks",
  name: "Matchsticks",
  moveSchema: z.object({ row: z.number().int().min(0).max(ROWS.length - 1), take: z.number().int().min(1).max(Math.max(...ROWS)) }),

  init: (players) => ({ players, rows: [...ROWS], turn: 0, last: null, winner: null }),

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.take > s.rows[m.row]) return "There aren't that many sticks in that row";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const rows = s.rows.map((n, i) => (i === m.row ? n - m.take : n));
    const empty = rows.every((n) => n === 0);
    // Taking the last stick loses.
    return { ...s, rows, turn: empty ? me : ((1 - me) as Seat), winner: empty ? s.players[1 - me] : null, last: { by: me, row: m.row, take: m.take } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove: (s, _p, rng) => pick(allMoves(s.rows), rng),

  botMove(s, _p, rng, level) {
    const moves = allMoves(s.rows);
    if (level === "easy" && rng() < 0.6) return pick(moves, rng);
    // Leave the other player a position they can't win from, if there is one.
    const good = moves.filter((m) => {
      const rows = s.rows.map((n, i) => (i === m.row ? n - m.take : n));
      return !rows.every((n) => n === 0) && losing(rows);
    });
    if (good.length) return pick(good, rng);
    // Otherwise take one stick and hope — but never the very last one if there's a choice.
    const safe = moves.filter((m) => m.take === 1 && s.rows.reduce((a, b) => a + b, 0) > 1);
    return pick(safe.length ? safe : moves, rng);
  },

  viewFor: (s) => s,
};
