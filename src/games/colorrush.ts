import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";

/**
 * Color Rush: a two-player shedding card game (Crazy Eights family).
 * Match the top card by color or by number/symbol. Action cards:
 *  - Block:      opponent loses their turn (you go again)
 *  - +2:         opponent draws 2 and loses their turn
 *  - Rainbow:    play on anything, choose the next color
 *  - Rainbow +4: choose the color, opponent draws 4 and loses their turn
 * Can't (or don't want to) play? Draw one. If it's playable you may play it, else pass.
 * First to empty their hand wins. The deck order and the opponent's hand stay secret.
 */

export const COLORS = ["coral", "gold", "teal", "violet"] as const;
export type Color = (typeof COLORS)[number];
export type Kind = "num" | "block" | "plus2" | "wild" | "wild4";
export interface Card { id: number; kind: Kind; color: Color | null; value: number | null }
export const HAND_SIZE = 7;
type Seat = 0 | 1;

export interface ColorRushState {
  players: Players;
  hands: [Card[], Card[]];
  deck: Card[]; // draw from the end
  discard: Card[]; // top = last
  color: Color; // color in play (differs from the top card after a Rainbow)
  turn: Seat;
  drew: boolean; // current player already drew this turn
  seed: number; // RNG state for reshuffles — secret
  last: { by: Seat; play: Card | null; drew: number; color: Color | null; forced: number } | null;
  winner: Outcome;
}

export type ColorRushMove =
  | { type: "play"; card: number; color?: Color }
  | { type: "draw" }
  | { type: "pass" };

export interface ColorRushView {
  players: Players;
  hand: Card[]; // the viewer's own cards (empty for spectators)
  counts: [number, number];
  top: Card;
  color: Color;
  turn: Seat;
  drew: boolean;
  deckCount: number;
  last: ColorRushState["last"];
  winner: Outcome;
}

/** mulberry32: small seeded RNG, so shuffles are reproducible from the stored seed. */
function rngFrom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, seed: () => a };
}

function shuffle<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, kind: "num", color, value: 0 });
    for (let v = 1; v <= 9; v++) for (let k = 0; k < 2; k++) cards.push({ id: id++, kind: "num", color, value: v });
    for (let k = 0; k < 2; k++) {
      cards.push({ id: id++, kind: "block", color, value: null });
      cards.push({ id: id++, kind: "plus2", color, value: null });
    }
  }
  for (let k = 0; k < 4; k++) {
    cards.push({ id: id++, kind: "wild", color: null, value: null });
    cards.push({ id: id++, kind: "wild4", color: null, value: null });
  }
  return cards; // 100 cards
}

export function canPlay(card: Card, top: Card, color: Color) {
  if (card.kind === "wild" || card.kind === "wild4") return true;
  if (card.color === color) return true;
  if (card.kind === "num") return top.kind === "num" && card.value === top.value;
  return card.kind === top.kind;
}

/** Draw n cards, reshuffling the discard pile (minus its top card) when the deck runs out. */
function draw(s: ColorRushState, seat: Seat, n: number): ColorRushState {
  let deck = [...s.deck];
  let discard = [...s.discard];
  let seed = s.seed;
  const hand = [...s.hands[seat]];
  for (let i = 0; i < n; i++) {
    if (!deck.length) {
      if (discard.length <= 1) break; // nothing left to draw
      const r = rngFrom(seed);
      deck = shuffle(discard.slice(0, -1), r.next);
      seed = r.seed();
      discard = discard.slice(-1);
    }
    hand.push(deck.pop()!);
  }
  const hands: ColorRushState["hands"] = [...s.hands];
  hands[seat] = hand;
  return { ...s, deck, discard, seed, hands };
}

const top = (s: ColorRushState) => s.discard[s.discard.length - 1];
const other = (seat: Seat) => (1 - seat) as Seat;

export const colorRush: GameEngine<ColorRushState, ColorRushMove> = {
  id: "colorrush",
  name: "Color Rush",
  hiddenInfo: true,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("play"), card: z.number().int(), color: z.enum(COLORS).optional() }),
    z.object({ type: z.literal("draw") }),
    z.object({ type: z.literal("pass") }),
  ]),

  init(players, seed) {
    const r = rngFrom(seed);
    let deck = shuffle(buildDeck(), r.next);
    // Start on a number card.
    while (deck[deck.length - 1].kind !== "num") deck = shuffle(deck, r.next);
    const first = deck.pop()!;
    const hands: [Card[], Card[]] = [[], []];
    for (let i = 0; i < HAND_SIZE; i++) for (const seat of [0, 1] as Seat[]) hands[seat].push(deck.pop()!);
    return {
      players, hands, deck, discard: [first], color: first.color!, turn: 0, drew: false,
      seed: r.seed(), last: null, winner: null,
    };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (move.type === "draw") return s.drew ? "You already drew this turn" : null;
    if (move.type === "pass") return s.drew ? null : "Draw a card first";
    const card = s.hands[seat].find((c) => c.id === move.card);
    if (!card) return "You don't have that card";
    if (!canPlay(card, top(s), s.color)) return "That card doesn't match";
    if ((card.kind === "wild" || card.kind === "wild4") && !move.color) return "Pick a color";
    return null;
  },

  apply(s, move, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    const opp = other(seat);

    if (move.type === "pass") {
      return { ...s, turn: opp, drew: false, last: { by: seat, play: null, drew: 0, color: null, forced: 0 } };
    }

    if (move.type === "draw") {
      const next = draw(s, seat, 1);
      const got = next.hands[seat][next.hands[seat].length - 1];
      const drewOne = next.hands[seat].length > s.hands[seat].length;
      const last = { by: seat, play: null, drew: drewOne ? 1 : 0, color: null, forced: 0 };
      // Drawn card unplayable (or nothing to draw): turn passes automatically.
      if (!drewOne || !canPlay(got, top(s), s.color)) return { ...next, turn: opp, drew: false, last };
      return { ...next, drew: true, last };
    }

    const card = s.hands[seat].find((c) => c.id === move.card)!;
    const hands: ColorRushState["hands"] = [...s.hands];
    hands[seat] = s.hands[seat].filter((c) => c.id !== card.id);
    let next: ColorRushState = {
      ...s, hands, discard: [...s.discard, card], color: card.color ?? move.color!, drew: false,
    };
    const forced = card.kind === "plus2" ? 2 : card.kind === "wild4" ? 4 : 0;
    if (forced) next = draw(next, opp, forced);
    const again = card.kind === "block" || forced > 0; // opponent loses their turn
    const winner = hands[seat].length === 0 ? s.players[seat] : null;
    return {
      ...next,
      turn: again && !winner ? seat : opp,
      winner,
      last: { by: seat, play: card, drew: 0, color: card.color ? null : move.color!, forced },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    const hand = s.hands[seat];
    const playable = hand.filter((c) => canPlay(c, top(s), s.color));
    if (playable.length) {
      const card = playable.find((c) => c.color !== null) ?? playable[0];
      if (card.color) return { type: "play", card: card.id };
      // Rainbow: pick the color we hold most of.
      const counts = COLORS.map((col) => hand.filter((c) => c.color === col).length);
      return { type: "play", card: card.id, color: COLORS[counts.indexOf(Math.max(...counts))] };
    }
    return s.drew ? { type: "pass" } : { type: "draw" };
  },

  viewFor(s, viewerId): ColorRushView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    return {
      players: s.players,
      hand: me === 0 || me === 1 ? s.hands[me] : [],
      counts: [s.hands[0].length, s.hands[1].length],
      top: top(s),
      color: s.color,
      turn: s.turn,
      drew: s.drew,
      deckCount: s.deck.length,
      last: s.last,
      winner: s.winner,
    };
  },
};
