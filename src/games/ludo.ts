import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom } from "./util";

/**
 * Ludo: race your pieces once round the board and up your home column.
 * A 6 brings a piece out of the yard and earns another roll; landing on someone
 * sends them back to their yard. First to bring every piece home wins.
 *
 * A piece's place is its "progress": -1 in the yard, 0-50 on the shared track
 * (0 = its own start square), 51-55 in its home column, 56 = home.
 */

export const TRACK = 52;
export const HOME = 56;
/** Squares where a piece can't be captured: the four start squares and the four stars. */
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
/** Which corner each seat starts from, by table size (two players sit opposite). */
export const corners = (n: number) => (n === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, n));
/** Shared-track square (0-51) of a piece that is `progress` steps from its own start. */
export const square = (n: number, seat: number, progress: number) => (corners(n)[seat] * 13 + progress) % TRACK;

type Seat = number;

export interface LudoState {
  players: Players;
  pieces: number[][]; // progress of each piece, per seat
  turn: Seat;
  /** The roll waiting to be used, when there is a choice of piece. */
  roll: number | null;
  sixes: number; // sixes in a row this turn
  seed: number; // RNG state — secret
  last: {
    by: Seat;
    roll: number;
    /** Which piece moved, and where from and to (progress). Absent if nothing could move. */
    piece?: number; from?: number; to?: number;
    /** Seats that had a piece sent back to the yard. */
    hit?: Seat[];
    note?: "stuck" | "three";
  } | null;
  winner: Outcome;
}

export type LudoMove = { type: "roll" } | { type: "move"; piece: number };
export type LudoView = Omit<LudoState, "seed">;

/** Pieces of this seat that can use this roll. */
export function movable(s: Pick<LudoState, "pieces">, seat: Seat, roll: number): number[] {
  return s.pieces[seat].flatMap((p, i) => ((p === -1 ? roll === 6 : p + roll <= HOME) ? [i] : []));
}

/** Move one piece, capture, and work out whose turn is next. */
function advance(s: LudoState, piece: number, roll: number, seed: number, sixes: number): LudoState {
  const me = s.turn;
  const n = s.players.length;
  const from = s.pieces[me][piece];
  const to = from === -1 ? 0 : from + roll;
  const pieces = s.pieces.map((row) => [...row]);
  pieces[me][piece] = to;
  const hit: Seat[] = [];
  if (to <= 50) {
    const here = square(n, me, to);
    if (!SAFE.includes(here)) {
      pieces.forEach((row, seat) => {
        if (seat === me) return;
        row.forEach((p, i) => {
          if (p >= 0 && p <= 50 && square(n, seat, p) === here) {
            row[i] = -1;
            if (!hit.includes(seat)) hit.push(seat);
          }
        });
      });
    }
  }
  const won = pieces[me].every((p) => p === HOME);
  // A six, a capture or a piece reaching home earns another roll.
  const again = !won && (roll === 6 || hit.length > 0 || to === HOME);
  return {
    ...s, pieces, seed, roll: null,
    sixes: again ? sixes : 0,
    turn: again || won ? me : (me + 1) % n,
    last: { by: me, roll, piece, from, to, ...(hit.length ? { hit } : {}) },
    winner: won ? s.players[me] : null,
  };
}

export const ludo: GameEngine<LudoState, LudoMove> = {
  id: "ludo",
  name: "Ludo",
  hiddenInfo: true, // only the dice still to come
  maxPlayers: 4,
  rules: [{ id: "quick", label: "Quick game", hint: "Two pieces each instead of four." }],
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("roll") }),
    z.object({ type: z.literal("move"), piece: z.number().int().min(0).max(3) }),
  ]),

  init(players, seed, rules = {}) {
    const count = rules.quick ? 2 : 4;
    return { players, pieces: players.map(() => Array(count).fill(-1)), turn: 0, roll: null, sixes: 0, seed, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.type === "roll") return s.roll === null ? null : "Move a piece first";
    if (s.roll === null) return "Roll the die first";
    if (!movable(s, seat, s.roll).includes(m.piece)) return "That piece can't move";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    if (m.type === "move") return advance(s, m.piece, s.roll!, s.seed, s.sixes);

    const r = rngFrom(s.seed);
    const roll = 1 + Math.floor(r.next() * 6);
    const seed = r.seed();
    const pass = (note: "stuck" | "three"): LudoState =>
      ({ ...s, seed, roll: null, sixes: 0, turn: (me + 1) % s.players.length, last: { by: me, roll, note } });
    const sixes = roll === 6 ? s.sixes + 1 : 0;
    if (sixes === 3) return pass("three"); // three sixes in a row: the turn is lost
    const options = movable(s, me, roll);
    if (!options.length) return pass("stuck");
    // No real choice (one piece, or pieces standing together)? Move straight away.
    if (new Set(options.map((i) => s.pieces[me][i])).size === 1) return advance(s, options[0], roll, seed, sixes);
    return { ...s, seed, roll, sixes, last: { by: me, roll } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 20,
  botPace: "step",

  autoMove(s, playerId, rng) {
    if (s.roll === null) return { type: "roll" };
    return { type: "move", piece: pick(movable(s, s.players.indexOf(playerId), s.roll), rng) };
  },

  botMove(s, playerId, rng, level) {
    if (s.roll === null) return { type: "roll" };
    const me = s.players.indexOf(playerId);
    const n = s.players.length;
    const options = movable(s, me, s.roll);
    if (level === "easy") return { type: "move", piece: pick(options, rng) };
    // Prefer, in order: a capture, getting home, leaving the yard, a safe square, then the piece furthest on.
    const worth = (i: number) => {
      const from = s.pieces[me][i];
      const to = from === -1 ? 0 : from + s.roll!;
      let v = to / 10;
      if (to === HOME) v += 40;
      if (from === -1) v += 30;
      if (to <= 50) {
        const here = square(n, me, to);
        if (SAFE.includes(here)) v += 8;
        else if (s.pieces.some((row, seat) => seat !== me && row.some((p) => p >= 0 && p <= 50 && square(n, seat, p) === here))) v += 50;
      }
      return v;
    };
    return { type: "move", piece: options.reduce((a, b) => (worth(b) > worth(a) ? b : a)) };
  },

  viewFor(s): LudoView {
    const { seed: _seed, ...rest } = s;
    void _seed;
    return rest;
  },
};
