import type { AnyEngine, Outcome } from "./types";
import { uuid } from "./util";

/**
 * Platform rules that sit around every game engine: room options, turn deadlines,
 * missed turns and forfeits, the running match score, the computer opponent, and the
 * move log used for replays. Pure functions (time and randomness are passed in).
 *
 * Stored in rooms.state as { $engine, $meta }. $engine is null until two players have
 * joined. Older rooms that hold a bare engine state still load (they get fresh meta).
 */

/** Disconnect grace period: miss turns adding up to this and you forfeit. */
export const GRACE_SECONDS = 60;

/** The computer opponent's player id. */
export const BOT_ID = "00000000-0000-4000-8000-0000000000b0";
export type BotLevel = "easy" | "hard";

export interface RoomOptions {
  /** 1 = free play (a running score is still kept); 3 or 5 = first to 2 or 3 wins. */
  bestOf: 1 | 3 | 5;
  /** Only friends of the creator may join, and nobody may spectate. */
  private: boolean;
  bot: BotLevel | null;
  /** Game-specific house rules, e.g. Color Rush "stacking". */
  rules: Record<string, boolean>;
}
export const DEFAULT_OPTIONS: RoomOptions = { bestOf: 1, private: false, bot: null, rules: {} };

export interface Series {
  wins: Record<string, number>;
  draws: number;
  games: number;
  /** Consecutive wins by the same player. */
  streak: { id: string; n: number } | null;
  /** A best-of match has been decided. */
  done: boolean;
}
const freshSeries = (): Series => ({ wins: {}, draws: 0, games: 0, streak: null, done: false });

export interface Meta {
  /** When the current turn/round times out (ms since epoch), or null if no clock. */
  deadline: number | null;
  /** Consecutive timed-out turns per player. Reset when they move. */
  misses: Record<string, number>;
  /** Player who forfeited, if any. */
  forfeit: string | null;
  options: RoomOptions;
  series: Series;
  /** Replay of the current game: init(order, seed, rules), then each [seat, move]. */
  seed: number;
  order: [string, string] | null;
  log: [number, unknown][];
  /** Set once this game's result has been counted; also its id in the results table. */
  resultId: string | null;
}

interface Stored {
  $engine: unknown;
  $meta: Partial<Meta>;
}

const freshMeta = (): Meta => ({
  deadline: null, misses: {}, forfeit: null,
  options: DEFAULT_OPTIONS, series: freshSeries(),
  seed: 0, order: null, log: [], resultId: null,
});

/** Meta for a room that has been created but hasn't started. */
export const newRoomMeta = (options: RoomOptions): Meta => ({ ...freshMeta(), options });

export function unwrap(raw: unknown): { state: unknown; meta: Meta } {
  if (raw && typeof raw === "object" && "$meta" in raw) {
    const s = raw as Stored;
    return { state: s.$engine ?? null, meta: { ...freshMeta(), ...s.$meta } };
  }
  return { state: raw ?? null, meta: freshMeta() };
}

export const wrap = (state: unknown, meta: Meta): Stored => ({ $engine: state, $meta: meta });

export function outcome(engine: AnyEngine, state: unknown, meta: Meta): Outcome {
  if (meta.forfeit) {
    const players = (state as { players: [string, string] }).players;
    return players[0] === meta.forfeit ? players[1] : players[0];
  }
  return engine.winner(state);
}

export function waitingOn(engine: AnyEngine, state: unknown): string[] {
  if (engine.winner(state) !== null) return [];
  if (engine.waitingOn) return engine.waitingOn(state);
  const t = engine.turn(state);
  return t ? [t] : [];
}

/** Missed turns allowed before forfeiting, so the total idle time ≈ GRACE_SECONDS. */
export function missLimit(seconds: number) {
  return Math.max(2, Math.ceil(GRACE_SECONDS / seconds));
}

/** Wins needed to take a best-of match. */
export const winsNeeded = (bestOf: number) => Math.ceil(bestOf / 2);

const seatOf = (state: unknown, id: string) => (state as { players: string[] }).players.indexOf(id);

/**
 * Recompute the deadline after a state change. A simultaneous round keeps its clock
 * while players lock in one by one; anything else starts a new clock. The computer
 * never needs a clock.
 */
function withDeadline(engine: AnyEngine, before: unknown | null, after: unknown, meta: Meta, now: number): Meta {
  if (outcome(engine, after, meta) !== null) return { ...meta, deadline: null };
  const next = waitingOn(engine, after).filter((p) => p !== BOT_ID);
  if (!next.length) return { ...meta, deadline: null };
  const prev = before === null ? [] : waitingOn(engine, before).filter((p) => p !== BOT_ID);
  const strictSubset = next.length < prev.length && next.every((p) => prev.includes(p));
  if (strictSubset && meta.deadline !== null) return meta;
  return { ...meta, deadline: now + engine.timeLimit(after) * 1000 };
}

/** Count a finished game into the match score, once. */
function settle(engine: AnyEngine, state: unknown, meta: Meta): Meta {
  const w = outcome(engine, state, meta);
  if (w === null || meta.resultId) return meta;
  const s = meta.series;
  const wins = { ...s.wins };
  let { streak, draws } = s;
  if (w === "draw") {
    draws++;
    streak = null;
  } else {
    wins[w] = (wins[w] ?? 0) + 1;
    streak = streak?.id === w ? { id: w, n: streak.n + 1 } : { id: w, n: 1 };
  }
  const done = meta.options.bestOf > 1 && w !== "draw" && wins[w] >= winsNeeded(meta.options.bestOf);
  return {
    ...meta,
    deadline: null,
    resultId: uuid(),
    series: { wins, draws, games: s.games + 1, streak, done },
  };
}

/** Clock for an already-created game state (keeps options and score from `prev`). */
export function start(engine: AnyEngine, state: unknown, now: number, prev?: Meta): Meta {
  const base: Meta = {
    ...freshMeta(),
    options: prev?.options ?? DEFAULT_OPTIONS,
    series: prev && !prev.series.done ? prev.series : freshSeries(),
  };
  return withDeadline(engine, null, state, base, now);
}

/** Start a new game for `players` (game order: players[0] acts first). */
export function begin(engine: AnyEngine, players: [string, string], seed: number, prev: Meta | null, now: number) {
  const options = prev?.options ?? DEFAULT_OPTIONS;
  const state = engine.init(players, seed, options.rules);
  const meta: Meta = { ...start(engine, state, now, prev ?? undefined), seed, order: players };
  return { state, meta };
}

function applyLogged(
  engine: AnyEngine, state: unknown, meta: Meta, move: unknown, playerId: string, now: number,
) {
  const next = engine.apply(state, move, playerId);
  const m: Meta = { ...meta, log: [...meta.log, [seatOf(state, playerId), move]] };
  return { state: next, meta: settle(engine, next, withDeadline(engine, state, next, m, now)) };
}

export function playerMove(
  engine: AnyEngine, state: unknown, meta: Meta, move: unknown, playerId: string, now: number,
) {
  return applyLogged(engine, state, { ...meta, misses: { ...meta.misses, [playerId]: 0 } }, move, playerId, now);
}

/**
 * Let the computer act for as long as the game is waiting on it. In simultaneous
 * games it locks in at the start of the round, before the human has chosen.
 */
export function botTurns(
  engine: AnyEngine, state: unknown, meta: Meta, now: number, rng: () => number, maxMoves = 200,
) {
  let s = state;
  let m = meta;
  for (let i = 0; i < maxMoves; i++) {
    if (outcome(engine, s, m) !== null || !waitingOn(engine, s).includes(BOT_ID)) break;
    let move = (engine.botMove ?? engine.autoMove)(s, BOT_ID, rng, m.options.bot ?? "hard");
    if (engine.validate(s, move, BOT_ID) !== null) move = engine.autoMove(s, BOT_ID, rng);
    if (engine.validate(s, move, BOT_ID) !== null) break; // never apply an illegal move
    ({ state: s, meta: m } = applyLogged(engine, s, m, move, BOT_ID, now));
  }
  return { state: s, meta: m };
}

/**
 * Enforce an expired clock: every player still waiting misses a turn. Too many misses
 * in a row = forfeit; otherwise the engine plays a safe move for them.
 * Returns null if the clock hasn't run out (or there is no clock).
 */
export function timeout(engine: AnyEngine, state: unknown, meta: Meta, now: number, rng: () => number) {
  if (meta.deadline === null || now < meta.deadline || outcome(engine, state, meta) !== null) return null;
  const limit = missLimit(engine.timeLimit(state));
  let s = state;
  let m: Meta = { ...meta, misses: { ...meta.misses } };
  for (const p of waitingOn(engine, state)) {
    if (p === BOT_ID) continue;
    m.misses[p] = (m.misses[p] ?? 0) + 1;
    if (m.misses[p] >= limit) {
      m = settle(engine, s, { ...m, deadline: null, forfeit: p });
      return { state: s, meta: m, forfeited: p as string | null };
    }
    ({ state: s, meta: m } = applyLogged(engine, s, m, engine.autoMove(s, p, rng), p, now));
  }
  // Auto-moves may have ended a simultaneous round; make sure a fresh clock is running.
  if (outcome(engine, s, m) === null && m.deadline !== null && m.deadline <= now) {
    m = { ...m, deadline: now + engine.timeLimit(s) * 1000 };
  }
  return { state: s, meta: m, forfeited: null };
}
