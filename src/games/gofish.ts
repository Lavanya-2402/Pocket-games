import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom, shuffle } from "./util";

/**
 * Go Fish: ask another player for a rank you hold. If they have any, they hand them
 * all over and you ask again; if not, you "go fish" — draw a card — and the turn moves on
 * (unless you drew the very rank you asked for). Four of a rank make a set, which is
 * laid down. Most sets wins.
 *
 * A card is a number 0-51: rank = card % 13 (0 = Ace … 12 = King), suit = floor(card / 13).
 */

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["♠", "♥", "♦", "♣"];
export const rankOf = (card: number) => card % 13;
export const handSize = (players: number) => (players <= 3 ? 7 : 5);
type Seat = number;

export interface GoFishState {
  players: Players;
  hands: number[][]; // secret
  deck: number[]; // draw from the end — secret
  sets: number[][]; // ranks completed, per seat
  /** Ranks each player is known to hold, from what they asked for or were given. Public. */
  known: number[][];
  turn: Seat;
  last: {
    by: Seat; from: Seat; rank: number;
    /** Cards handed over; 0 = go fish. */
    got: number;
    /** Went fishing and drew the rank asked for. */
    lucky: boolean;
    /** Sets completed by this move. */
    made: number[];
  } | null;
  winner: Outcome;
}

export type GoFishMove = { from: number; rank: number };

export interface GoFishView {
  players: Players;
  hand: number[];
  counts: number[];
  deck: number;
  sets: number[][];
  turn: Seat;
  last: GoFishState["last"];
  winner: Outcome;
}

/** Lay down any complete sets in a hand. Returns the ranks completed. */
function laySets(hand: number[], sets: number[], known: number[]): number[] {
  const made: number[] = [];
  for (let rank = 0; rank < 13; rank++) {
    if (hand.filter((c) => rankOf(c) === rank).length === 4) {
      made.push(rank);
      sets.push(rank);
      for (let i = hand.length - 1; i >= 0; i--) if (rankOf(hand[i]) === rank) hand.splice(i, 1);
      const k = known.indexOf(rank);
      if (k >= 0) known.splice(k, 1);
    }
  }
  return made;
}

export const goFish: GameEngine<GoFishState, GoFishMove> = {
  id: "gofish",
  name: "Go Fish",
  hiddenInfo: true,
  maxPlayers: 4,
  moveSchema: z.object({ from: z.number().int().min(0).max(3), rank: z.number().int().min(0).max(12) }),

  init(players, seed) {
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rngFrom(seed).next);
    const n = handSize(players.length);
    const hands = players.map(() => deck.splice(-n));
    const sets = players.map((): number[] => []);
    const known = players.map((): number[] => []);
    hands.forEach((h, i) => laySets(h, sets[i], known[i])); // dealt four of a kind: it happens
    return { players, hands, deck, sets, known, turn: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.from === seat || m.from >= s.players.length) return "Ask another player";
    if (!s.hands[seat].some((c) => rankOf(c) === m.rank)) return "You can only ask for a rank you hold";
    return null;
  },

  apply(s, m) {
    const me = s.turn;
    const n = s.players.length;
    const hands = s.hands.map((h) => [...h]);
    const sets = s.sets.map((x) => [...x]);
    const known = s.known.map((x) => [...x]);
    const deck = [...s.deck];
    const note = (seat: number, rank: number) => {
      if (!known[seat].includes(rank)) known[seat].push(rank);
    };
    const forget = (seat: number, rank: number) => {
      known[seat] = known[seat].filter((r) => r !== rank);
    };

    note(me, m.rank); // asking shows you hold it
    const given = hands[m.from].filter((c) => rankOf(c) === m.rank);
    let again = false, lucky = false;
    if (given.length) {
      hands[m.from] = hands[m.from].filter((c) => rankOf(c) !== m.rank);
      hands[me].push(...given);
      forget(m.from, m.rank);
      again = true;
    } else if (deck.length) {
      const card = deck.pop()!;
      hands[me].push(card);
      lucky = rankOf(card) === m.rank;
      again = lucky;
    }
    const made = laySets(hands[me], sets[me], known[me]);

    // Whose turn next? Anyone with an empty hand draws a card first, or sits out if the deck is gone.
    let turn = again ? me : (me + 1) % n;
    let winner: Outcome = null;
    for (let tries = 0; ; tries++) {
      if (hands.every((h) => h.length === 0) || tries > n) {
        const best = Math.max(...sets.map((x) => x.length));
        winner = sets.filter((x) => x.length === best).length > 1 ? "draw" : s.players[sets.findIndex((x) => x.length === best)];
        turn = me;
        break;
      }
      if (hands[turn].length) break;
      if (deck.length) {
        hands[turn].push(deck.pop()!);
        break;
      }
      turn = (turn + 1) % n;
    }

    return { ...s, hands, deck, sets, known, turn, winner, last: { by: me, from: m.from, rank: m.rank, got: given.length, lucky, made } };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, playerId, rng) {
    const me = s.players.indexOf(playerId);
    const others = s.players.map((_, i) => i).filter((i) => i !== me);
    const withCards = others.filter((i) => s.hands[i].length > 0);
    return { from: pick(withCards.length ? withCards : others, rng), rank: rankOf(pick(s.hands[me], rng)) };
  },

  // Plays from what everyone at the table could know: who asked for what, and who was handed what.
  botMove(s, playerId, rng, level) {
    const me = s.players.indexOf(playerId);
    const mine = [...new Set(s.hands[me].map(rankOf))];
    const others = s.players.map((_, i) => i).filter((i) => i !== me);
    const withCards = others.filter((i) => s.hands[i].length > 0);
    const pool = withCards.length ? withCards : others;
    if (level === "hard" || rng() < 0.4) {
      for (const seat of pool) {
        const sure = mine.filter((r) => s.known[seat].includes(r));
        if (sure.length) return { from: seat, rank: pick(sure, rng) };
      }
    }
    // Otherwise go for the rank it holds most of, from whoever has the most cards.
    const held = (r: number) => s.hands[me].filter((c) => rankOf(c) === r).length;
    const rank = level === "hard" ? mine.reduce((a, b) => (held(b) > held(a) ? b : a)) : pick(mine, rng);
    const from = level === "hard" ? pool.reduce((a, b) => (s.hands[b].length > s.hands[a].length ? b : a)) : pick(pool, rng);
    return { from, rank };
  },

  viewFor(s, viewerId): GoFishView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    return {
      players: s.players,
      hand: me >= 0 ? s.hands[me] : [],
      counts: s.hands.map((h) => h.length),
      deck: s.deck.length,
      sets: s.sets,
      turn: s.turn,
      last: s.last,
      winner: s.winner,
    };
  },
};
