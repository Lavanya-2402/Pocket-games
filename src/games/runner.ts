import type { AnyEngine, Outcome } from "./types";

/**
 * Platform rules that sit around every game engine: turn deadlines, missed turns
 * and forfeits. Pure functions (time is passed in) so they're easy to test.
 *
 * Stored in rooms.state as { $engine, $meta }. Older rooms that hold a bare engine
 * state still load (they just get fresh meta).
 */

/** Disconnect grace period: miss turns adding up to this and you forfeit. */
export const GRACE_SECONDS = 60;

export interface Meta {
  /** When the current turn/round times out (ms since epoch), or null if no clock. */
  deadline: number | null;
  /** Consecutive timed-out turns per player. Reset when they move. */
  misses: Record<string, number>;
  /** Player who forfeited, if any. */
  forfeit: string | null;
}

interface Stored {
  $engine: unknown;
  $meta: Meta;
}

const freshMeta = (): Meta => ({ deadline: null, misses: {}, forfeit: null });

export function unwrap(raw: unknown): { state: unknown; meta: Meta } {
  if (raw && typeof raw === "object" && "$engine" in raw) {
    const s = raw as Stored;
    return { state: s.$engine, meta: s.$meta };
  }
  return { state: raw, meta: freshMeta() };
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

/**
 * Recompute the deadline after a state change. A simultaneous round keeps its clock
 * while players lock in one by one; anything else starts a new clock.
 */
function withDeadline(engine: AnyEngine, before: unknown | null, after: unknown, meta: Meta, now: number): Meta {
  if (outcome(engine, after, meta) !== null) return { ...meta, deadline: null };
  const next = waitingOn(engine, after);
  if (!next.length) return { ...meta, deadline: null };
  const prev = before === null ? [] : waitingOn(engine, before);
  const strictSubset = next.length < prev.length && next.every((p) => prev.includes(p));
  if (strictSubset && meta.deadline !== null) return meta;
  return { ...meta, deadline: now + engine.timeLimit(after) * 1000 };
}

export function start(engine: AnyEngine, state: unknown, now: number): Meta {
  return withDeadline(engine, null, state, freshMeta(), now);
}

export function playerMove(
  engine: AnyEngine, state: unknown, meta: Meta, move: unknown, playerId: string, now: number,
) {
  const next = engine.apply(state, move, playerId);
  const m = { ...meta, misses: { ...meta.misses, [playerId]: 0 } };
  return { state: next, meta: withDeadline(engine, state, next, m, now) };
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
  const misses = { ...meta.misses };
  for (const p of waitingOn(engine, state)) {
    misses[p] = (misses[p] ?? 0) + 1;
    if (misses[p] >= limit) {
      const m: Meta = { deadline: null, misses, forfeit: p };
      return { state: s, meta: m, forfeited: p as string | null };
    }
    s = engine.apply(s, engine.autoMove(s, p, rng), p);
  }
  return { state: s, meta: withDeadline(engine, state, s, { ...meta, misses }, now), forfeited: null };
}
