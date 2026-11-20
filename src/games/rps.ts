import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Rock Paper Scissors. Both players pick in secret; both picks are shown together.
 * Rock blunts scissors, scissors cut paper, paper wraps rock. First to win the
 * target number of rounds takes the game.
 */

export const TARGET = 3;
export const MAX_ROUNDS = 15;
export const THROWS = ["rock", "paper", "scissors"] as const;
export type Throw = (typeof THROWS)[number];
const BEATS: Record<Throw, Throw> = { rock: "scissors", paper: "rock", scissors: "paper" };

export interface RpsState {
  players: Players;
  wins: [number, number];
  pending: [Throw | null, Throw | null];
  round: number;
  last: { throws: [Throw, Throw]; winner: 0 | 1 | null } | null;
  winner: Outcome;
}

export type RpsMove = { pick: Throw };
export type RpsView = Omit<RpsState, "pending"> & { pending: [Throw | "hidden" | null, Throw | "hidden" | null] };

export const rps: GameEngine<RpsState, RpsMove> = {
  id: "rps",
  name: "Rock Paper Scissors",
  hiddenInfo: true,
  moveSchema: z.object({ pick: z.enum(THROWS) }),

  init: (players) => ({ players, wins: [0, 0], pending: [null, null], round: 1, last: null, winner: null }),

  validate(s, _m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (s.pending[seat]) return "You already picked this round";
    return null;
  },

  apply(s, m, playerId) {
    const seat = s.players.indexOf(playerId);
    const pending: RpsState["pending"] = [...s.pending];
    pending[seat] = m.pick;
    const [a, b] = pending;
    if (!a || !b) return { ...s, pending };
    const won = a === b ? null : BEATS[a] === b ? 0 : 1;
    const wins: [number, number] = [s.wins[0] + (won === 0 ? 1 : 0), s.wins[1] + (won === 1 ? 1 : 0)];
    let winner: Outcome = null;
    if (wins[0] >= TARGET || wins[1] >= TARGET) winner = s.players[wins[0] > wins[1] ? 0 : 1];
    else if (s.round >= MAX_ROUNDS) winner = wins[0] === wins[1] ? "draw" : s.players[wins[0] > wins[1] ? 0 : 1];
    return { ...s, wins, pending: [null, null], round: s.round + 1, last: { throws: [a, b], winner: won }, winner };
  },

  winner: (s) => s.winner,
  turn: () => null, // both pick at once
  waitingOn: (s) => s.players.filter((_, i) => s.pending[i] === null),
  timeLimit: () => 12,
  autoMove: (_s, _p, rng) => ({ pick: pick(THROWS, rng) }),
  botMove: (_s, _p, rng) => ({ pick: pick(THROWS, rng) }),

  viewFor(s, viewerId): RpsView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const mask = (i: number) => (s.pending[i] === null ? null : i === me ? s.pending[i] : "hidden");
    return { ...s, pending: [mask(0), mask(1)] };
  },
};
