import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { rngFrom } from "./util";

/**
 * Climb & Slide: a race up a numbered board. Land at the foot of a rope and climb it;
 * land at the top of a slide and go back down. Pure luck — good for a quick laugh.
 */

export const COLS = 8;
export const LAST = COLS * COLS;
/** Ropes go up, slides go down. No square is both an end and a start. */
export const JUMPS: Record<number, number> = {
  4: 19, 11: 28, 22: 39, 33: 50, 44: 59, // ropes
  62: 41, 55: 36, 47: 30, 31: 12, 25: 7, 17: 5, // slides
};
type Seat = number;

export interface ClimbState {
  players: Players;
  /** Square each player stands on; 0 = not on the board yet. */
  pos: number[];
  turn: Seat;
  seed: number; // RNG state — secret
  last: { by: Seat; roll: number; from: number; landed: number; to: number } | null;
  winner: Outcome;
}

export type ClimbMove = { type: "roll" };
export type ClimbView = Omit<ClimbState, "seed">;

export const climb: GameEngine<ClimbState, ClimbMove> = {
  id: "climb",
  name: "Climb & Slide",
  hiddenInfo: true, // only the dice still to come
  maxPlayers: 4,
  moveSchema: z.object({ type: z.literal("roll") }),

  init(players, seed) {
    return { players, pos: players.map(() => 0), turn: 0, seed, last: null, winner: null };
  },

  validate(s, _m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    return null;
  },

  apply(s) {
    const me = s.turn;
    const r = rngFrom(s.seed);
    const roll = 1 + Math.floor(r.next() * 6);
    const from = s.pos[me];
    const landed = Math.min(LAST, from + roll);
    const to = JUMPS[landed] ?? landed;
    const won = to === LAST;
    return {
      ...s,
      seed: r.seed(),
      pos: s.pos.map((p, i) => (i === me ? to : p)),
      // A six rolls again.
      turn: won || roll === 6 ? me : (me + 1) % s.players.length,
      last: { by: me, roll, from, landed, to },
      winner: won ? s.players[me] : null,
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 15,
  botPace: "step",
  autoMove: () => ({ type: "roll" }),
  botMove: () => ({ type: "roll" }),

  viewFor(s): ClimbView {
    const { seed: _seed, ...rest } = s;
    void _seed;
    return rest;
  },
};
