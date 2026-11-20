import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { rngFrom } from "./util";

/**
 * Liar's Dice for two to four. Each round everyone rolls in secret. Take turns bidding
 * how many dice of one face there are across ALL hands ("three 4s"). Each bid must be
 * higher than the last — or you can call "Liar!" on the bid before you. All dice are
 * then shown: if the bid was true the caller loses a die, otherwise the bidder does.
 * Lose all your dice and you're out; the last player with dice wins.
 */

export const DICE = 5;
type Seat = number;

export interface Bid { q: number; face: number; by: Seat }

export interface LiarsDiceState {
  players: Players;
  dice: number[][]; // secret: each player sees only their own
  seed: number; // secret: drives the next roll
  bid: Bid | null;
  turn: Seat;
  round: number;
  /** The showdown that ended the previous round. */
  reveal: { dice: number[][]; bid: Bid; count: number; caller: Seat; loser: Seat } | null;
  winner: Outcome;
}

export type LiarsDiceMove = { type: "bid"; q: number; face: number } | { type: "call" };

export type LiarsDiceView = Omit<LiarsDiceState, "dice" | "seed"> & {
  /** Your own dice (empty for spectators). */
  hand: number[];
  /** Dice each player has left; 0 means they are out. */
  counts: number[];
};

function rollAll(counts: number[], seed: number) {
  const r = rngFrom(seed);
  const dice = counts.map((n) => Array.from({ length: n }, () => 1 + Math.floor(r.next() * 6)).sort((a, b) => a - b));
  return { dice, seed: r.seed() };
}

export const higher = (q: number, face: number, than: Bid | null) =>
  !than || q > than.q || (q === than.q && face > than.face);

/** The next seat after `from` that still has dice. */
function nextAlive(counts: number[], from: Seat) {
  for (let i = 1; i <= counts.length; i++) {
    const seat = (from + i) % counts.length;
    if (counts[seat] > 0) return seat;
  }
  return from;
}

/** Chance that at least `need` of `n` unseen dice show one particular face. */
function atLeast(need: number, n: number) {
  if (need <= 0) return 1;
  if (need > n) return 0;
  let p = 0;
  for (let k = need; k <= n; k++) {
    let comb = 1;
    for (let i = 0; i < k; i++) comb = (comb * (n - i)) / (i + 1);
    p += comb * (1 / 6) ** k * (5 / 6) ** (n - k);
  }
  return p;
}

export const liarsDice: GameEngine<LiarsDiceState, LiarsDiceMove> = {
  id: "liarsdice",
  name: "Liar's Dice",
  hiddenInfo: true,
  maxPlayers: 4,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("bid"), q: z.number().int().min(1).max(DICE * 4), face: z.number().int().min(1).max(6) }),
    z.object({ type: z.literal("call") }),
  ]),

  init(players, seed) {
    const first = rollAll(players.map(() => DICE), seed);
    return { players, ...first, bid: null, turn: 0, round: 1, reveal: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (m.type === "call") return s.bid ? null : "There is no bid to call yet";
    if (m.q > s.dice.flat().length) return "There aren't that many dice left";
    return higher(m.q, m.face, s.bid) ? null : "Bid higher: more dice, or the same number of a higher face";
  },

  apply(s, m, playerId) {
    const seat = s.players.indexOf(playerId);
    const counts = s.dice.map((d) => d.length);
    if (m.type === "bid") return { ...s, bid: { q: m.q, face: m.face, by: seat }, turn: nextAlive(counts, seat) };

    const bid = s.bid!;
    const count = s.dice.flat().filter((d) => d === bid.face).length;
    const loser: Seat = count >= bid.q ? seat : bid.by; // true bid → the caller pays
    counts[loser]--;
    const reveal = { dice: s.dice, bid, count, caller: seat, loser };
    const alive = counts.filter((n) => n > 0).length;
    if (alive === 1) {
      const dice = s.dice.map((d, i) => (i === loser ? d.slice(1) : d));
      return { ...s, reveal, bid: null, dice, winner: s.players[counts.findIndex((n) => n > 0)] };
    }
    // New round: the loser opens it (or the next player, if that was their last die).
    const opener = counts[loser] > 0 ? loser : nextAlive(counts, loser);
    return { ...s, ...rollAll(counts, s.seed), reveal, bid: null, turn: opener, round: s.round + 1 };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, playerId) {
    if (s.bid) return { type: "call" };
    const seat = s.players.indexOf(playerId);
    return { type: "bid", q: 1, face: s.dice[seat][0] };
  },

  // Judges every bid by how likely it is, knowing its own dice and guessing the rest.
  botMove(s, playerId, rng, level) {
    const seat = s.players.indexOf(playerId);
    const mine = s.dice[seat];
    const total = s.dice.flat().length;
    const unseen = total - mine.length;
    const have = (face: number) => mine.filter((d) => d === face).length;
    const chance = (q: number, face: number) => atLeast(q - have(face), unseen);
    const nerve = level === "hard" ? 0.38 : 0.2 + rng() * 0.4; // call when a bid looks less likely than this

    if (s.bid && chance(s.bid.q, s.bid.face) < nerve) return { type: "call" };
    // Legal raises close to the current bid; pick the most believable.
    const options: { q: number; face: number; p: number }[] = [];
    const from = s.bid?.q ?? 1;
    for (let q = from; q <= Math.min(total, from + 1); q++) {
      for (let face = 1; face <= 6; face++) {
        if (higher(q, face, s.bid)) options.push({ q, face, p: chance(q, face) });
      }
    }
    if (!options.length) return { type: "call" };
    const best = Math.max(...options.map((o) => o.p));
    if (s.bid && best < 0.25) return { type: "call" }; // every raise is a bad bluff
    const pool = options.filter((o) => o.p >= best - (level === "hard" ? 0.02 : 0.25));
    const pickOne = pool[Math.floor(rng() * pool.length)];
    return { type: "bid", q: pickOne.q, face: pickOne.face };
  },

  viewFor(s, viewerId): LiarsDiceView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const { dice, seed: _seed, ...rest } = s;
    void _seed;
    return { ...rest, hand: me >= 0 ? dice[me] : [], counts: dice.map((d) => d.length) };
  },
};
