import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { rngFrom, shuffle } from "./util";

/**
 * Color Rush: a shedding card game for two to four (Crazy Eights family).
 * Match the top card by color or by number/symbol. Action cards:
 *  - Block:      the next player loses their turn
 *  - +2:         the next player draws 2 and loses their turn
 *  - Rainbow:    play on anything, choose the next color
 *  - Rainbow +4: choose the color, the next player draws 4 and loses their turn
 * Can't (or don't want to) play? Draw one. If it's playable you may play it, else pass.
 * First to empty their hand wins. The deck order and everyone else's hand stay secret.
 *
 * Optional house rules (chosen when the room is created) are listed in RULES below.
 */

export const COLORS = ["coral", "gold", "teal", "violet"] as const;
export type Color = (typeof COLORS)[number];
export type Kind = "num" | "block" | "plus2" | "wild" | "wild4";
export interface Card { id: number; kind: Kind; color: Color | null; value: number | null }
export const HAND_SIZE = 7;
export const RUSH_HAND = 5;
type Seat = number;

export const RULES = [
  { id: "stacking", label: "Stacking", hint: "Answer a +2 with your own +2 (or a +4 with a +4) and the total passes on." },
  { id: "swap", label: "Swap 7 / Spin 0", hint: "Playing a 7 or a 0 swaps hands with the next player." },
  { id: "jumpin", label: "Jump-in", hint: "Holding the exact same card as the top one? Play it at once, even out of turn." },
  { id: "drawmatch", label: "Draw till match", hint: "If you can't play, keep drawing until you can." },
  { id: "lastcard", label: "Last-card call", hint: "Call \"Last card!\" when you're down to one — or be caught and draw 2." },
  { id: "rush", label: "Rush mode", hint: "10-second turns and 5-card hands." },
];
export type RuleId = "stacking" | "swap" | "jumpin" | "drawmatch" | "lastcard" | "rush";

export interface ColorRushState {
  players: Players;
  hands: Card[][];
  deck: Card[]; // draw from the end
  discard: Card[]; // top = last
  color: Color; // color in play (differs from the top card after a Rainbow)
  turn: Seat;
  drew: boolean; // current player already drew this turn
  seed: number; // RNG state for reshuffles — secret
  last: {
    by: Seat; play: Card | null; drew: number; color: Color | null; forced: number;
    /** What else happened: hands swapped, a jump-in, a last-card call, or a catch. */
    note?: "swap" | "jumpin" | "call" | "catch";
    /** Who it happened to (drew the forced cards, was swapped with, was caught). */
    to?: Seat;
  } | null;
  winner: Outcome;
  /** House rules in force. */
  rules: Partial<Record<RuleId, boolean>>;
  /** Stacking: cards the player to move must draw unless they answer with the same kind. */
  stack: number;
  stackKind: "plus2" | "wild4" | null;
  /** Last-card call: who has said it, and who is on one card without having said it. */
  called: boolean[];
  uncalled: Seat | null;
}

export type ColorRushMove =
  | { type: "play"; card: number; color?: Color }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "call" }
  | { type: "catch" };

export interface ColorRushView {
  players: Players;
  hand: Card[]; // the viewer's own cards (empty for spectators)
  counts: number[];
  top: Card;
  color: Color;
  turn: Seat;
  drew: boolean;
  deckCount: number;
  last: ColorRushState["last"];
  winner: Outcome;
  rules: ColorRushState["rules"];
  stack: number;
  stackKind: ColorRushState["stackKind"];
  called: boolean[];
  uncalled: Seat | null;
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

/** Same colour and same number/symbol (Rainbows never count): the jump-in test. */
export const identical = (card: Card, top: Card) =>
  card.color !== null && card.kind === top.kind && card.color === top.color && card.value === top.value;

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
  const hands = [...s.hands];
  hands[seat] = hand;
  return { ...s, deck, discard, seed, hands };
}

const top = (s: ColorRushState) => s.discard[s.discard.length - 1];
/** The seat that plays after `seat`. */
const after = (s: ColorRushState, seat: Seat, steps = 1) => (seat + steps) % s.players.length;

/** Games stored before house rules existed lack these fields; fill them in. */
function withDefaults(s: ColorRushState): ColorRushState {
  return s.rules ? s : { ...s, rules: {}, stack: 0, stackKind: null, called: s.players.map(() => false), uncalled: null };
}

/** A "Last card!" call only stands while that player is on one or two cards. */
function tidy(s: ColorRushState): ColorRushState {
  return { ...s, called: s.called.map((c, i) => c && s.hands[i].length <= 2) };
}

export const colorRush: GameEngine<ColorRushState, ColorRushMove> = {
  id: "colorrush",
  name: "Color Rush",
  hiddenInfo: true,
  maxPlayers: 4,
  rules: RULES,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("play"), card: z.number().int(), color: z.enum(COLORS).optional() }),
    z.object({ type: z.literal("draw") }),
    z.object({ type: z.literal("pass") }),
    z.object({ type: z.literal("call") }),
    z.object({ type: z.literal("catch") }),
  ]),

  init(players, seed, rules = {}) {
    const r = rngFrom(seed);
    let deck = shuffle(buildDeck(), r.next);
    // Start on a number card.
    while (deck[deck.length - 1].kind !== "num") deck = shuffle(deck, r.next);
    const first = deck.pop()!;
    const hands: Card[][] = players.map(() => []);
    const size = rules.rush ? RUSH_HAND : HAND_SIZE;
    for (let i = 0; i < size; i++) for (const hand of hands) hand.push(deck.pop()!);
    return {
      players, hands, deck, discard: [first], color: first.color!, turn: 0, drew: false,
      seed: r.seed(), last: null, winner: null,
      rules, stack: 0, stackKind: null, called: players.map(() => false), uncalled: null,
    };
  },

  validate(raw, move, playerId) {
    const s = withDefaults(raw);
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    const myTurn = seat === s.turn;

    if (move.type === "call") {
      if (!s.rules.lastcard) return "Last-card calls aren't on in this game";
      if (s.hands[seat].length > 2) return "Call it when you're down to your last cards";
      return s.called[seat] ? "You've already called it" : null;
    }
    if (move.type === "catch") {
      return s.rules.lastcard && s.uncalled !== null && s.uncalled !== seat ? null : "Nothing to catch";
    }
    if (move.type === "play") {
      const card = s.hands[seat].find((c) => c.id === move.card);
      if (!card) return "You don't have that card";
      if (!myTurn) {
        // Jump-in: the exact same card, while nothing else is pending.
        return s.rules.jumpin && s.stack === 0 && !s.drew && identical(card, top(s)) ? null : "Not your turn";
      }
      if (s.stack > 0 && card.kind !== s.stackKind) {
        return `Answer with a ${s.stackKind === "plus2" ? "+2" : "+4"}, or draw ${s.stack}`;
      }
      if (!canPlay(card, top(s), s.color)) return "That card doesn't match";
      if (card.color === null && !move.color) return "Pick a color";
      return null;
    }
    if (!myTurn) return "Not your turn";
    if (move.type === "draw") return s.stack > 0 || !s.drew ? null : "You already drew this turn";
    if (s.stack > 0) return `Draw ${s.stack} first`;
    return s.drew ? null : "Draw a card first";
  },

  apply(raw, move, playerId) {
    const start = withDefaults(raw);
    const seat = start.players.indexOf(playerId);
    const blank = { by: seat, play: null, drew: 0, color: null, forced: 0 };

    if (move.type === "call") {
      const called = [...start.called];
      called[seat] = true;
      return { ...start, called, uncalled: start.uncalled === seat ? null : start.uncalled, last: { ...blank, note: "call" } };
    }
    if (move.type === "catch") {
      const who = start.uncalled!;
      return tidy({ ...draw(start, who, 2), uncalled: null, last: { ...blank, forced: 2, note: "catch", to: who } });
    }

    // Once someone else carries on with the game, the chance to catch is gone.
    const s = start.uncalled !== null && start.uncalled !== seat ? { ...start, uncalled: null } : start;
    const next = after(s, seat);

    if (move.type === "pass") return tidy({ ...s, turn: next, drew: false, last: blank });

    if (move.type === "draw") {
      if (s.stack > 0) {
        // Take the stacked penalty and lose the turn.
        const took = draw(s, seat, s.stack);
        return tidy({ ...took, stack: 0, stackKind: null, turn: next, drew: false, last: { ...blank, drew: s.stack } });
      }
      let now = s;
      let count = 0;
      let got: Card | undefined;
      const limit = s.rules.drawmatch ? 200 : 1;
      while (count < limit) {
        const before = now.hands[seat].length;
        now = draw(now, seat, 1);
        if (now.hands[seat].length === before) break; // nothing left to draw
        count++;
        got = now.hands[seat][now.hands[seat].length - 1];
        if (canPlay(got, top(s), s.color)) break;
      }
      const last = { ...blank, drew: count };
      // Nothing playable drawn: the turn passes automatically.
      if (!got || !canPlay(got, top(s), s.color)) return tidy({ ...now, turn: next, drew: false, last });
      return tidy({ ...now, drew: true, last });
    }

    const card = s.hands[seat].find((c) => c.id === move.card)!;
    const jumpIn = seat !== s.turn;
    let hands = [...s.hands];
    hands[seat] = s.hands[seat].filter((c) => c.id !== card.id);
    const winner = hands[seat].length === 0 ? s.players[seat] : null;
    let now: ColorRushState = {
      ...s, hands, discard: [...s.discard, card], color: card.color ?? move.color!, drew: false,
    };

    const penalty = card.kind === "plus2" ? 2 : card.kind === "wild4" ? 4 : 0;
    let forced = 0;
    let skip = card.kind === "block"; // the next player loses their turn
    let { stack, stackKind } = s;
    let to: Seat | undefined;
    if (penalty && !winner) {
      if (s.rules.stacking) {
        stack += penalty; // the next player must answer or take the lot
        stackKind = card.kind as "plus2" | "wild4";
      } else {
        now = draw(now, next, penalty);
        forced = penalty;
        skip = true;
        to = next;
      }
    }

    let note: "swap" | "jumpin" | undefined = jumpIn ? "jumpin" : undefined;
    if (s.rules.swap && !winner && card.kind === "num" && (card.value === 7 || card.value === 0)) {
      hands = [...now.hands];
      [hands[seat], hands[next]] = [hands[next], hands[seat]];
      now = { ...now, hands };
      note = "swap";
      to = next;
    }

    // Down to one card without having called it? You can be caught.
    const uncalled = s.rules.lastcard && !winner && now.hands[seat].length === 1 && !s.called[seat] ? seat : now.uncalled;

    return tidy({
      ...now, stack, stackKind, uncalled, winner,
      turn: winner ? s.turn : after(s, seat, skip && stack === 0 ? 2 : 1),
      last: { by: seat, play: card, drew: 0, color: card.color ? null : move.color!, forced, note, to },
    });
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: (s) => (s.rules?.rush ? 10 : 30),

  autoMove(raw, playerId) {
    const s = withDefaults(raw);
    const seat = s.players.indexOf(playerId);
    const hand = s.hands[seat];
    // Rainbow: pick the color we hold most of.
    const counts = COLORS.map((col) => hand.filter((c) => c.color === col).length);
    const bestColor = COLORS[counts.indexOf(Math.max(...counts))];
    const play = (card: Card): ColorRushMove =>
      card.color ? { type: "play", card: card.id } : { type: "play", card: card.id, color: bestColor };

    if (s.stack > 0) {
      const answer = hand.find((c) => c.kind === s.stackKind);
      return answer ? play(answer) : { type: "draw" };
    }
    const playable = hand.filter((c) => canPlay(c, top(s), s.color));
    if (playable.length) return play(playable.find((c) => c.color !== null) ?? playable[0]);
    return s.drew ? { type: "pass" } : { type: "draw" };
  },

  viewFor(raw, viewerId): ColorRushView {
    const s = withDefaults(raw);
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    return {
      players: s.players,
      hand: me >= 0 ? s.hands[me] : [],
      counts: s.hands.map((h) => h.length),
      top: top(s),
      color: s.color,
      turn: s.turn,
      drew: s.drew,
      deckCount: s.deck.length,
      last: s.last,
      winner: s.winner,
      rules: s.rules,
      stack: s.stack,
      stackKind: s.stackKind,
      called: s.called,
      uncalled: s.uncalled,
    };
  },
};
