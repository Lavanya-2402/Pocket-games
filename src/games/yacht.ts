import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom } from "./util";

/**
 * Yacht Dice: roll five dice up to three times a turn, keeping the ones you like,
 * then write the result into one of twelve boxes on your card. Each box is used once.
 * Highest total when every card is full wins.
 */

export const DICE = 5;
export const ROLLS = 3;
export const CATS = [
  { id: "ones", label: "Ones", hint: "Add up your 1s" },
  { id: "twos", label: "Twos", hint: "Add up your 2s" },
  { id: "threes", label: "Threes", hint: "Add up your 3s" },
  { id: "fours", label: "Fours", hint: "Add up your 4s" },
  { id: "fives", label: "Fives", hint: "Add up your 5s" },
  { id: "sixes", label: "Sixes", hint: "Add up your 6s" },
  { id: "full", label: "Full house", hint: "Three of one face and two of another: all five dice added up" },
  { id: "four", label: "Four alike", hint: "Four dice the same: those four added up" },
  { id: "little", label: "Low run", hint: "1-2-3-4-5 scores 30" },
  { id: "big", label: "High run", hint: "2-3-4-5-6 scores 30" },
  { id: "choice", label: "Choice", hint: "Any dice: all five added up" },
  { id: "yacht", label: "Yacht", hint: "All five the same scores 50" },
] as const;

type Seat = number;

/** What these dice are worth in a box. */
export function scoreFor(dice: readonly number[], cat: number): number {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  const sum = dice.reduce((a, b) => a + b, 0);
  if (cat < 6) return counts[cat + 1] * (cat + 1);
  switch (CATS[cat].id) {
    case "full": return counts.includes(3) && counts.includes(2) ? sum : 0;
    case "four": {
      const face = counts.findIndex((c, f) => f > 0 && c >= 4);
      return face > 0 ? face * 4 : 0;
    }
    case "little": return [1, 2, 3, 4, 5].every((f) => counts[f] === 1) ? 30 : 0;
    case "big": return [2, 3, 4, 5, 6].every((f) => counts[f] === 1) ? 30 : 0;
    case "choice": return sum;
    default: return counts.slice(1).includes(5) ? 50 : 0;
  }
}

export const total = (card: readonly (number | null)[]) => card.reduce<number>((a, b) => a + (b ?? 0), 0);

export interface YachtState {
  players: Players;
  /** 0 = not rolled yet this turn. */
  dice: number[];
  held: boolean[];
  rolls: number; // rolls used this turn
  cards: (number | null)[][]; // per seat, per box
  turn: Seat;
  seed: number; // RNG state — secret, or the next roll could be predicted
  last: { by: Seat; cat: number; pts: number; dice: number[] } | null;
  winner: Outcome;
}

export type YachtMove = { type: "roll"; hold?: boolean[] } | { type: "score"; cat: number };
export type YachtView = Omit<YachtState, "seed">;

const NONE = [false, false, false, false, false];
/** A good score for each box: what the computer aims for. */
const PAR = [3, 6, 9, 12, 15, 18, 22, 16, 30, 30, 22, 50];

export const yacht: GameEngine<YachtState, YachtMove> = {
  id: "yacht",
  name: "Yacht Dice",
  hiddenInfo: true, // only the dice still to come
  maxPlayers: 4,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("roll"), hold: z.array(z.boolean()).length(DICE).optional() }),
    z.object({ type: z.literal("score"), cat: z.number().int().min(0).max(CATS.length - 1) }),
  ]),

  init(players, seed) {
    return {
      players, dice: [0, 0, 0, 0, 0], held: NONE, rolls: 0,
      cards: players.map(() => Array(CATS.length).fill(null)),
      turn: 0, seed, last: null, winner: null,
    };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.type === "roll") {
      if (s.rolls >= ROLLS) return "No rolls left — choose a box to score";
      if (s.rolls > 0 && m.hold?.every(Boolean)) return "Let go of at least one die to roll again";
      return null;
    }
    if (s.rolls === 0) return "Roll the dice first";
    if (s.cards[seat][m.cat] !== null) return "You've already used that box";
    return null;
  },

  apply(s, m) {
    if (m.type === "roll") {
      const r = rngFrom(s.seed);
      const held = s.rolls > 0 && m.hold ? m.hold : NONE;
      const dice = s.dice.map((d, i) => (held[i] ? d : 1 + Math.floor(r.next() * 6)));
      return { ...s, dice, held, rolls: s.rolls + 1, seed: r.seed() };
    }
    const me = s.turn;
    const pts = scoreFor(s.dice, m.cat);
    const cards = s.cards.map((c, i) => (i === me ? c.map((v, j) => (j === m.cat ? pts : v)) : c));
    let winner: Outcome = null;
    if (cards.every((c) => c.every((v) => v !== null))) {
      const totals = cards.map(total);
      const best = Math.max(...totals);
      winner = totals.filter((t) => t === best).length > 1 ? "draw" : s.players[totals.indexOf(best)];
    }
    return {
      ...s, cards, winner, dice: [0, 0, 0, 0, 0], held: NONE, rolls: 0,
      turn: (me + 1) % s.players.length, last: { by: me, cat: m.cat, pts, dice: s.dice },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, playerId, rng) {
    if (s.rolls === 0) return { type: "roll" };
    const card = s.cards[s.players.indexOf(playerId)];
    const open = card.flatMap((v, i) => (v === null ? [i] : []));
    // On a time-out, take the best box on offer rather than throw the turn away.
    return { type: "score", cat: rng() < 0.5 ? pick(open, rng) : open.reduce((a, b) => (scoreFor(s.dice, b) > scoreFor(s.dice, a) ? b : a)) };
  },

  botMove(s, playerId, rng, level) {
    if (s.rolls === 0) return { type: "roll" };
    const card = s.cards[s.players.indexOf(playerId)];
    const open = card.flatMap((v, i) => (v === null ? [i] : []));
    const worth = (i: number) => scoreFor(s.dice, i) / PAR[i];
    const best = open.reduce((a, b) => (worth(b) > worth(a) ? b : a));
    const rollAgain = level === "hard" ? worth(best) < 1 : rng() < 0.5;
    if (s.rolls < ROLLS && rollAgain) {
      // Keep the face there is most of (the higher one on a tie) and roll the rest.
      let face = 1;
      for (let f = 2; f <= 6; f++) {
        if (s.dice.filter((d) => d === f).length >= s.dice.filter((d) => d === face).length) face = f;
      }
      const hold = s.dice.map((d) => d === face);
      if (!hold.every(Boolean)) return { type: "roll", hold };
    }
    if (level === "easy") return { type: "score", cat: open.reduce((a, b) => (scoreFor(s.dice, b) > scoreFor(s.dice, a) ? b : a)) };
    // Nothing fits? Give up the box that is worth least.
    return { type: "score", cat: worth(best) > 0 ? best : open.reduce((a, b) => (PAR[b] < PAR[a] ? b : a)) };
  },

  viewFor(s): YachtView {
    const { seed: _seed, ...rest } = s;
    void _seed;
    return rest;
  },
};
