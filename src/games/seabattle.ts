import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";

/**
 * Sea Battle: each player secretly places a fleet, then players take turns firing at
 * the other's grid. Sink every ship to win. The server never reveals the opponent's
 * ships until they're sunk (or the game ends).
 */

export const SIZE = 8;
export const FLEET = [4, 3, 3, 2] as const;
export const SHIP_NAMES: Record<number, string> = { 4: "Cruiser", 3: "Frigate", 2: "Patrol boat" };

export type Dir = "h" | "v";
export interface Ship { r: number; c: number; len: number; dir: Dir }
export interface Shot { r: number; c: number; hit: boolean }
type Seat = 0 | 1;

export interface SeaBattleState {
  players: Players;
  phase: "place" | "battle";
  fleets: [Ship[] | null, Ship[] | null];
  shots: [Shot[], Shot[]]; // shots[i] = shots fired BY seat i
  turn: Seat;
  last: { by: Seat; r: number; c: number; hit: boolean; sunk: number | null } | null;
  winner: Outcome;
}

export type SeaBattleMove =
  | { type: "place"; ships: Ship[] }
  | { type: "fire"; r: number; c: number };

/** One player's view: own fleet, both shot records, and only the enemy ships already sunk. */
export interface SeaBattleView {
  players: Players;
  phase: SeaBattleState["phase"];
  turn: Seat;
  winner: Outcome;
  last: SeaBattleState["last"];
  ready: [boolean, boolean];
  shots: [Shot[], Shot[]];
  /** Ships the viewer may see, per seat (own fleet; sunk enemy ships; everything at game end). */
  visible: [Ship[], Ship[]];
  /** Index into FLEET of each sunk ship, per seat. */
  sunk: [number[], number[]];
}

export const cells = (s: Ship) =>
  Array.from({ length: s.len }, (_, i) => (s.dir === "h" ? [s.r, s.c + i] : [s.r + i, s.c]) as [number, number]);

export function fleetProblem(ships: Ship[]): string | null {
  const lens = ships.map((s) => s.len).sort().join();
  if (lens !== [...FLEET].sort().join()) return "Wrong set of ships";
  const taken = new Set<string>();
  for (const s of ships) {
    for (const [r, c] of cells(s)) {
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return "Ship off the board";
      const k = `${r},${c}`;
      if (taken.has(k)) return "Ships overlap";
      taken.add(k);
    }
  }
  return null;
}

/** True if `ship` fits on the board without overlapping `others`. */
export function fits(ship: Ship, others: Ship[]) {
  const taken = new Set(others.flatMap((o) => cells(o).map(([r, c]) => `${r},${c}`)));
  return cells(ship).every(([r, c]) => r >= 0 && c >= 0 && r < SIZE && c < SIZE && !taken.has(`${r},${c}`));
}

export function randomFleet(rng: () => number): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    for (const len of FLEET) {
      for (let tries = 0; tries < 200; tries++) {
        const dir: Dir = rng() < 0.5 ? "h" : "v";
        const ship = {
          r: Math.floor(rng() * (dir === "v" ? SIZE - len + 1 : SIZE)),
          c: Math.floor(rng() * (dir === "h" ? SIZE - len + 1 : SIZE)),
          len,
          dir,
        };
        if (fits(ship, ships)) {
          ships.push(ship);
          break;
        }
      }
    }
    if (ships.length === FLEET.length) return ships;
  }
}

function sunkIndexes(fleet: Ship[] | null, incoming: Shot[]): number[] {
  if (!fleet) return [];
  const hits = new Set(incoming.filter((s) => s.hit).map((s) => `${s.r},${s.c}`));
  return fleet.flatMap((ship, i) => (cells(ship).every(([r, c]) => hits.has(`${r},${c}`)) ? [i] : []));
}

const placeSchema = z.object({
  type: z.literal("place"),
  ships: z.array(z.object({
    r: z.number().int(), c: z.number().int(), len: z.number().int(), dir: z.enum(["h", "v"]),
  })).length(FLEET.length),
});
const fireSchema = z.object({
  type: z.literal("fire"),
  r: z.number().int().min(0).max(SIZE - 1),
  c: z.number().int().min(0).max(SIZE - 1),
});

export const seaBattle: GameEngine<SeaBattleState, SeaBattleMove> = {
  id: "seabattle",
  name: "Sea Battle",
  hiddenInfo: true,
  moveSchema: z.discriminatedUnion("type", [placeSchema, fireSchema]),

  init(players) {
    return { players, phase: "place", fleets: [null, null], shots: [[], []], turn: 0, last: null, winner: null };
  },

  validate(s, move, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (move.type === "place") {
      if (s.phase !== "place") return "Ships are already placed";
      if (s.fleets[seat]) return "You already placed your ships";
      return fleetProblem(move.ships);
    }
    if (s.phase !== "battle") return "Waiting for both fleets";
    if (seat !== s.turn) return "Not your turn";
    if (s.shots[seat].some((x) => x.r === move.r && x.c === move.c)) return "You already fired there";
    return null;
  },

  apply(s, move, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    if (move.type === "place") {
      const fleets: SeaBattleState["fleets"] = [...s.fleets];
      fleets[seat] = move.ships.map(({ r, c, len, dir }) => ({ r, c, len, dir }));
      return { ...s, fleets, phase: fleets[0] && fleets[1] ? "battle" : "place" };
    }
    const opp = (1 - seat) as Seat;
    const target = s.fleets[opp]!;
    const hit = target.some((ship) => cells(ship).some(([r, c]) => r === move.r && c === move.c));
    const shots: SeaBattleState["shots"] = [[...s.shots[0]], [...s.shots[1]]];
    shots[seat].push({ r: move.r, c: move.c, hit });
    const before = sunkIndexes(target, s.shots[seat]);
    const after = sunkIndexes(target, shots[seat]);
    const sunk = after.find((i) => !before.includes(i)) ?? null;
    const winner = after.length === target.length ? s.players[seat] : null;
    return { ...s, shots, turn: opp, last: { by: seat, r: move.r, c: move.c, hit, sunk }, winner };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner || s.phase === "place" ? null : s.players[s.turn]),
  waitingOn: (s) =>
    s.phase === "place" ? s.players.filter((_, i) => !s.fleets[i]) : [s.players[s.turn]],
  timeLimit: (s) => (s.phase === "place" ? 60 : 30),

  autoMove(s, playerId, rng) {
    const seat = s.players.indexOf(playerId) as Seat;
    if (s.phase === "place") return { type: "place", ships: randomFleet(rng) };
    // Out of time: fire next to an unfinished hit if there is one, else anywhere new.
    const tried = new Set(s.shots[seat].map((x) => `${x.r},${x.c}`));
    const sunkCells = new Set(
      sunkIndexes(s.fleets[1 - seat], s.shots[seat]).flatMap((i) => cells(s.fleets[1 - seat]![i]).map(([r, c]) => `${r},${c}`)),
    );
    const near: [number, number][] = [];
    for (const x of s.shots[seat]) {
      if (!x.hit || sunkCells.has(`${x.r},${x.c}`)) continue;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = x.r + dr, c = x.c + dc;
        if (r >= 0 && c >= 0 && r < SIZE && c < SIZE && !tried.has(`${r},${c}`)) near.push([r, c]);
      }
    }
    const open: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!tried.has(`${r},${c}`)) open.push([r, c]);
    const pool = near.length ? near : open;
    const [r, c] = pool[Math.floor(rng() * pool.length)];
    return { type: "fire", r, c };
  },

  viewFor(s, viewerId): SeaBattleView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const sunk: [number[], number[]] = [sunkIndexes(s.fleets[0], s.shots[1]), sunkIndexes(s.fleets[1], s.shots[0])];
    const visibleFor = (seat: Seat): Ship[] => {
      const fleet = s.fleets[seat];
      if (!fleet) return [];
      if (seat === me || s.winner) return fleet;
      return sunk[seat].map((i) => fleet[i]);
    };
    return {
      players: s.players,
      phase: s.phase,
      turn: s.turn,
      winner: s.winner,
      last: s.last,
      ready: [!!s.fleets[0], !!s.fleets[1]],
      shots: s.shots,
      visible: [visibleFor(0), visibleFor(1)],
      sunk,
    };
  },
};
