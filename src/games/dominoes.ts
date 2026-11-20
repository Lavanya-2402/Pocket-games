import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick, rngFrom, shuffle } from "./util";

/**
 * Dominoes (the draw game, double-six set). Play a tile whose number matches either
 * end of the line. Can't? Draw from the pile until you can. First to play every tile
 * wins; if nobody can move, the lightest hand wins.
 */

export type Tile = [number, number];
export type Side = "left" | "right";
export const HAND = 7;
type Seat = number;

export interface DominoState {
  players: Players;
  hands: Tile[][]; // secret
  /** The line on the table, left to right; each tile is turned so touching numbers match. */
  chain: Tile[];
  stock: Tile[]; // the pile to draw from — secret
  turn: Seat;
  passes: number; // passes in a row
  last: { by: Seat; kind: "play" | "draw" | "pass"; tile?: Tile; side?: Side } | null;
  winner: Outcome;
}

export type DominoMove =
  | { type: "play"; tile: number; side: Side } // tile = position in your hand
  | { type: "draw" }
  | { type: "pass" };

export interface DominoView {
  players: Players;
  hand: Tile[];
  counts: number[];
  chain: Tile[];
  stock: number;
  turn: Seat;
  passes: number;
  last: DominoState["last"];
  winner: Outcome;
  /** Everyone's tiles — only once the game is over. */
  hands: Tile[][] | null;
}

/** Which ends of the line this tile can go on. */
export function fits(tile: Tile, chain: readonly Tile[]): Side[] {
  if (!chain.length) return ["right"];
  const l = chain[0][0], r = chain[chain.length - 1][1];
  const out: Side[] = [];
  if (tile.includes(l)) out.push("left");
  if (tile.includes(r)) out.push("right");
  return out;
}

export const pips = (hand: readonly Tile[]) => hand.reduce((a, t) => a + t[0] + t[1], 0);
const canPlay = (hand: readonly Tile[], chain: readonly Tile[]) => hand.some((t) => fits(t, chain).length > 0);

export const dominoes: GameEngine<DominoState, DominoMove> = {
  id: "dominoes",
  name: "Dominoes",
  hiddenInfo: true,
  maxPlayers: 4,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("play"), tile: z.number().int().min(0).max(27), side: z.enum(["left", "right"]) }),
    z.object({ type: z.literal("draw") }),
    z.object({ type: z.literal("pass") }),
  ]),

  init(players, seed) {
    const all: Tile[] = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b]);
    const deck = shuffle(all, rngFrom(seed).next);
    const hands = players.map((_, i) => deck.slice(i * HAND, (i + 1) * HAND));
    return { players, hands, chain: [], stock: deck.slice(players.length * HAND), turn: 0, passes: 0, last: null, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    const hand = s.hands[seat];
    if (m.type === "play") {
      const tile = hand[m.tile];
      if (!tile) return "You don't have that tile";
      return fits(tile, s.chain).includes(m.side) || !s.chain.length ? null : "That tile doesn't match that end";
    }
    if (canPlay(hand, s.chain)) return "You have a tile that fits — play it";
    if (m.type === "draw") return s.stock.length ? null : "The pile is empty — pass";
    return s.stock.length ? "Draw from the pile first" : null;
  },

  apply(s, m) {
    const me = s.turn;
    const n = s.players.length;
    const next = (me + 1) % n;
    if (m.type === "draw") {
      const stock = s.stock.slice(0, -1);
      const tile = s.stock[s.stock.length - 1];
      return { ...s, stock, hands: s.hands.map((h, i) => (i === me ? [...h, tile] : h)), last: { by: me, kind: "draw" } };
    }
    if (m.type === "pass") {
      const passes = s.passes + 1;
      let winner: Outcome = null;
      if (passes >= n) {
        // Nobody can move: the lightest hand wins.
        const weights = s.hands.map(pips);
        const best = Math.min(...weights);
        winner = weights.filter((w) => w === best).length > 1 ? "draw" : s.players[weights.indexOf(best)];
      }
      return { ...s, passes, winner, turn: winner ? me : next, last: { by: me, kind: "pass" } };
    }
    const tile = s.hands[me][m.tile];
    const flip = (t: Tile): Tile => [t[1], t[0]];
    let chain: Tile[];
    if (!s.chain.length) chain = [tile];
    else if (m.side === "left") chain = [tile[1] === s.chain[0][0] ? tile : flip(tile), ...s.chain];
    else chain = [...s.chain, tile[0] === s.chain[s.chain.length - 1][1] ? tile : flip(tile)];
    const hands = s.hands.map((h, i) => (i === me ? h.filter((_, j) => j !== m.tile) : h));
    const won = hands[me].length === 0;
    return {
      ...s, chain, hands, passes: 0, turn: won ? me : next,
      winner: won ? s.players[me] : null,
      last: { by: me, kind: "play", tile, side: s.chain.length ? m.side : "right" },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 30,

  autoMove(s, playerId, rng) {
    const hand = s.hands[s.players.indexOf(playerId)];
    const options = hand.flatMap((t, i) => fits(t, s.chain).map((side) => ({ type: "play" as const, tile: i, side })));
    if (options.length) return pick(options, rng);
    return s.stock.length ? { type: "draw" } : { type: "pass" };
  },

  botMove(s, playerId, rng, level) {
    const hand = s.hands[s.players.indexOf(playerId)];
    const options = hand.flatMap((t, i) => fits(t, s.chain).map((side) => ({ type: "play" as const, tile: i, side })));
    if (!options.length) return s.stock.length ? { type: "draw" } : { type: "pass" };
    if (level === "easy") return pick(options, rng);
    // Get rid of heavy tiles first, doubles before anything (they fit in fewer places).
    const weight = (o: { tile: number }) => {
      const [a, b] = hand[o.tile];
      return a + b + (a === b ? 7 : 0);
    };
    return options.reduce((a, b) => (weight(b) > weight(a) ? b : a));
  },

  viewFor(s, viewerId): DominoView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    return {
      players: s.players,
      hand: me >= 0 ? s.hands[me] : [],
      counts: s.hands.map((h) => h.length),
      chain: s.chain,
      stock: s.stock.length,
      turn: s.turn,
      passes: s.passes,
      last: s.last?.kind === "draw" ? { by: s.last.by, kind: "draw" } : s.last,
      winner: s.winner,
      hands: s.winner ? s.hands : null,
    };
  },
};
