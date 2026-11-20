import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { rngFrom } from "./util";

/**
 * Greedy Dice: roll two dice as often as you dare and add them to the pot.
 * Bank the pot to keep it — but roll a 1 and the pot is gone, and two 1s wipe
 * out everything you had banked. First to the target wins.
 */

export const TARGET = 75;
type Seat = number;

export interface GreedyState {
  players: Players;
  scores: number[];
  pot: number;
  turn: Seat;
  seed: number; // RNG state — secret
  last: {
    by: Seat;
    dice: [number, number] | null;
    /** roll = added to the pot, bust = a 1 lost the pot, wipe = two 1s lost everything, bank = pot kept. */
    kind: "roll" | "bust" | "wipe" | "bank";
    amount: number;
  } | null;
  winner: Outcome;
}

export type GreedyMove = { type: "roll" } | { type: "bank" };
export type GreedyView = Omit<GreedyState, "seed">;

export const greedy: GameEngine<GreedyState, GreedyMove> = {
  id: "greedy",
  name: "Greedy Dice",
  hiddenInfo: true, // only the dice still to come
  maxPlayers: 4,
  moveSchema: z.discriminatedUnion("type", [z.object({ type: z.literal("roll") }), z.object({ type: z.literal("bank") })]),

  init(players, seed) {
    return { players, scores: players.map(() => 0), pot: 0, turn: 0, seed, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.type === "bank" && s.pot === 0) return "Roll first — there is nothing in the pot";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const next = (me + 1) % s.players.length;
    if (m.type === "bank") {
      const scores = s.scores.map((v, i) => (i === me ? v + s.pot : v));
      const won = scores[me] >= TARGET;
      return { ...s, scores, pot: 0, turn: won ? me : next, winner: won ? s.players[me] : null, last: { by: me, dice: null, kind: "bank", amount: s.pot } };
    }
    const r = rngFrom(s.seed);
    const dice: [number, number] = [1 + Math.floor(r.next() * 6), 1 + Math.floor(r.next() * 6)];
    const seed = r.seed();
    if (dice[0] === 1 && dice[1] === 1) {
      const lost = s.scores[me] + s.pot;
      return { ...s, seed, scores: s.scores.map((v, i) => (i === me ? 0 : v)), pot: 0, turn: next, last: { by: me, dice, kind: "wipe", amount: lost } };
    }
    if (dice[0] === 1 || dice[1] === 1) {
      return { ...s, seed, pot: 0, turn: next, last: { by: me, dice, kind: "bust", amount: s.pot } };
    }
    return { ...s, seed, pot: s.pot + dice[0] + dice[1], last: { by: me, dice, kind: "roll", amount: dice[0] + dice[1] } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 20,
  botPace: "step", // show every roll the computer makes

  // On a time-out, keep what is in the pot.
  autoMove: (s, _p, rng) => (s.pot > 0 && rng() < 0.6 ? { type: "bank" } : { type: "roll" }),

  botMove(s, playerId, rng, level) {
    const mine = s.scores[s.players.indexOf(playerId)];
    if (s.pot === 0) return { type: "roll" };
    if (mine + s.pot >= TARGET) return { type: "bank" };
    // Hard banks at about 20, a little more when it is behind; easy stops whenever it gets nervous.
    const behind = Math.max(...s.scores) - mine;
    const enough = level === "hard" ? 18 + Math.min(10, Math.floor(behind / 8)) : 8 + Math.floor(rng() * 14);
    return s.pot >= enough ? { type: "bank" } : { type: "roll" };
  },

  viewFor(s): GreedyView {
    const { seed: _seed, ...rest } = s;
    void _seed;
    return rest;
  },
};
