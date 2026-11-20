import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { leader, pick, rngFrom, shuffle } from "./util";

/**
 * Memory Match: flip two cards. A matching pair is yours and you go again; otherwise
 * both stay face up until the next player starts their turn, then turn back over.
 * Most pairs wins. Card faces stay on the server until they are flipped.
 */

export const PAIRS = 10;
export const COLS = 5;
export const FACES = ["🍎", "🚀", "🎸", "🐙", "🌵", "⚽", "🎲", "🍩", "🦄", "🌙"];
type Seat = number;

export interface MemoryState {
  players: Players;
  /** Pair id of each card. Secret until flipped. */
  cards: number[];
  /** Who has won each card (null = still on the table). */
  owner: (Seat | null)[];
  /** Cards currently face up but not won: one mid-turn, or a mismatched two being shown. */
  up: number[];
  /** Cards that have been turned over at least once (everyone has seen them). */
  seen: boolean[];
  turn: Seat;
  last: { by: Seat; cards: number[]; pair: boolean } | null;
  winner: Outcome;
}

export type MemoryMove = { card: number };

export type MemoryView = Omit<MemoryState, "cards"> & {
  /** Pair id for cards the viewer may see right now, null for face-down cards. */
  faces: (number | null)[];
};

export const pairsWon = (s: Pick<MemoryState, "owner" | "players">) =>
  s.players.map((_, seat) => s.owner.filter((o) => o === seat).length / 2);

export const memory: GameEngine<MemoryState, MemoryMove> = {
  id: "memory",
  name: "Memory Match",
  hiddenInfo: true,
  maxPlayers: 4,
  moveSchema: z.object({ card: z.number().int().min(0).max(PAIRS * 2 - 1) }),

  init(players, seed) {
    const ids = Array.from({ length: PAIRS * 2 }, (_, i) => Math.floor(i / 2));
    return {
      players,
      cards: shuffle(ids, rngFrom(seed).next),
      owner: Array(PAIRS * 2).fill(null),
      up: [],
      seen: Array(PAIRS * 2).fill(false),
      turn: 0,
      last: null,
      winner: null,
    };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (s.owner[m.card] !== null) return "That pair is already taken";
    if (s.up.length === 1 && s.up[0] === m.card) return "Pick a different card";
    return null;
  },

  apply(s, m) {
    const up = s.up.length === 2 ? [] : [...s.up]; // a shown mismatch turns back over
    up.push(m.card);
    const seen = [...s.seen];
    seen[m.card] = true;
    if (up.length === 1) return { ...s, up, seen };

    const [a, b] = up;
    if (s.cards[a] !== s.cards[b]) {
      return { ...s, up, seen, turn: (s.turn + 1) % s.players.length, last: { by: s.turn, cards: up, pair: false } };
    }
    const owner = [...s.owner];
    owner[a] = owner[b] = s.turn;
    const won = pairsWon({ owner, players: s.players });
    const top = owner.every((o) => o !== null) ? leader(won, 0) : null;
    const winner: Outcome = top === null ? null : top === "draw" ? "draw" : s.players[top];
    return { ...s, up: [], seen, owner, winner, last: { by: s.turn, cards: up, pair: true } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 20,
  botPace: "step", // each flip must be seen before the next one

  autoMove(s, _p, rng) {
    const down = s.owner.flatMap((o, i) => (o === null && !(s.up.length === 1 && s.up[0] === i) ? [i] : []));
    return { card: pick(down, rng) };
  },

  // The computer only "remembers" cards that have actually been turned over.
  botMove(s, _p, rng, level) {
    const first = s.up.length === 1 ? s.up[0] : null;
    const free = s.owner.flatMap((o, i) => (o === null && i !== first ? [i] : []));
    const forgetful = level === "easy" ? rng() < 0.55 : rng() < 0.1;
    const known = free.filter((i) => s.seen[i]);
    const unseen = free.filter((i) => !s.seen[i]);
    if (!forgetful) {
      if (first !== null) {
        const partner = known.find((i) => s.cards[i] === s.cards[first]);
        if (partner !== undefined) return { card: partner };
      } else {
        const twin = known.find((i) => known.some((j) => j !== i && s.cards[j] === s.cards[i]));
        if (twin !== undefined) return { card: twin };
      }
    }
    return { card: pick(unseen.length ? unseen : free, rng) };
  },

  viewFor(s): MemoryView {
    const { cards, ...rest } = s;
    const shown = (i: number) => s.owner[i] !== null || s.up.includes(i) || s.winner !== null;
    return { ...rest, faces: cards.map((c, i) => (shown(i) ? c : null)) };
  },
};
