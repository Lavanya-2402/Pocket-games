import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";

/**
 * Simultaneous Duel: both players secretly pick an action, then both are revealed.
 *  - Attack  (1 energy): 1 damage, blocked by Defend
 *  - Blast   (3 energy): 2 damage, can't be blocked
 *  - Defend  (free):     blocks Attack; at most 2 rounds in a row
 *  - Charge  (free):     +1 energy (max 5)
 * Reach 0 HP and you lose (both at once = draw). After the last round, more HP wins.
 */

export const MAX_HP = 5;
export const START_ENERGY = 1;
export const MAX_ENERGY = 5;
export const MAX_DEFENDS = 2;
export const MAX_ROUNDS = 15;
export const COST = { attack: 1, blast: 3, defend: 0, charge: 0 } as const;

export const ACTIONS = ["attack", "defend", "charge", "blast"] as const;
export type Action = (typeof ACTIONS)[number];
export type DuelMove = { action: Action };
type Seat = 0 | 1;

export interface DuelState {
  players: Players;
  hp: [number, number];
  energy: [number, number];
  defendStreak: [number, number];
  pending: [Action | null, Action | null];
  round: number;
  last: { actions: [Action, Action]; damage: [number, number] } | null;
  winner: Outcome;
}

export type DuelView = Omit<DuelState, "pending"> & {
  pending: [Action | "hidden" | null, Action | "hidden" | null];
};

/** Damage `attacker` deals to someone doing `defender`. */
function hit(attacker: Action, defender: Action) {
  if (attacker === "blast") return 2;
  if (attacker === "attack") return defender === "defend" ? 0 : 1;
  return 0;
}

export function whyNot(s: Pick<DuelState, "energy" | "defendStreak">, seat: Seat, action: Action): string | null {
  if (s.energy[seat] < COST[action]) return `${action === "blast" ? "Blast" : "Attack"} needs ${COST[action]} energy`;
  if (action === "defend" && s.defendStreak[seat] >= MAX_DEFENDS) return `Can't defend more than ${MAX_DEFENDS} rounds in a row`;
  return null;
}

export const duel: GameEngine<DuelState, DuelMove> = {
  id: "duel",
  name: "Simultaneous Duel",
  hiddenInfo: true,
  moveSchema: z.object({ action: z.enum(ACTIONS) }),

  init(players) {
    return {
      players,
      hp: [MAX_HP, MAX_HP],
      energy: [START_ENERGY, START_ENERGY],
      defendStreak: [0, 0],
      pending: [null, null],
      round: 1,
      last: null,
      winner: null,
    };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Duel is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (s.pending[seat]) return "You already picked this round";
    return whyNot(s, seat as Seat, move.action);
  },

  apply(s, move, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    const pending: DuelState["pending"] = [...s.pending];
    pending[seat] = move.action;
    const [a, b] = pending;
    if (!a || !b) return { ...s, pending };

    const damage: [number, number] = [hit(b, a), hit(a, b)]; // damage taken by each seat
    const hp: [number, number] = [Math.max(0, s.hp[0] - damage[0]), Math.max(0, s.hp[1] - damage[1])];
    const energy = ([a, b] as Action[]).map((act, i) =>
      Math.min(MAX_ENERGY, s.energy[i] - COST[act] + (act === "charge" ? 1 : 0)),
    ) as [number, number];
    const defendStreak = ([a, b] as Action[]).map((act, i) =>
      act === "defend" ? s.defendStreak[i] + 1 : 0,
    ) as [number, number];

    let winner: Outcome = null;
    if (hp[0] === 0 || hp[1] === 0) {
      winner = hp[0] === 0 && hp[1] === 0 ? "draw" : hp[0] === 0 ? s.players[1] : s.players[0];
    } else if (s.round >= MAX_ROUNDS) {
      winner = hp[0] === hp[1] ? "draw" : hp[0] > hp[1] ? s.players[0] : s.players[1];
    }

    return {
      ...s,
      hp,
      energy,
      defendStreak,
      pending: [null, null],
      round: s.round + 1,
      last: { actions: [a, b], damage },
      winner,
    };
  },

  winner: (s) => s.winner,
  turn: () => null, // simultaneous
  viewFor(s, viewerId): DuelView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const mask = (i: number) => (s.pending[i] === null ? null : i === me ? s.pending[i] : "hidden");
    return { ...s, pending: [mask(0), mask(1)] };
  },
};
