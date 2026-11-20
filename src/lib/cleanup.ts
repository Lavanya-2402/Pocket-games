import { getEngine } from "@/games";
import { outcome, unwrap } from "@/games/runner";
import { db, isMissing } from "./server";

/**
 * Housekeeping: delete data nobody needs any more. Server-only.
 *
 * - Finished (or never-started) rooms, an hour after anyone last touched them
 * - Any room untouched for a day (abandoned mid-game)
 * - The old per-move log (the move list now lives with the game and its replay)
 * - Expired invites
 * - Replay data older than 30 days (the win/loss record itself is kept)
 *
 * Deleting a room also removes its players, moves and invites (database cascade).
 * Results are kept: they are what records and leaderboards are counted from.
 */

const HOUR = 3_600_000;
export const FINISHED_AFTER = HOUR; // finished or never started
export const ABANDONED_AFTER = 24 * HOUR; // any room
export const INVITE_AFTER = 15 * 60_000;
export const REPLAY_AFTER = 30 * 24 * HOUR;

/** Is this room safe to delete once it has been idle for FINISHED_AFTER? */
export function isDone(game: string, rawState: unknown) {
  const engine = getEngine(game);
  const { state, meta } = unwrap(rawState);
  if (!engine || state === null) return true; // unknown game, or nobody ever started
  return outcome(engine, state, meta) !== null;
}

export interface CleanupReport { rooms: number; moves: number; invites: number; replays: number }

export async function cleanup(now = Date.now()): Promise<CleanupReport> {
  const iso = (ms: number) => new Date(now - ms).toISOString();
  const report: CleanupReport = { rooms: 0, moves: 0, invites: 0, replays: 0 };
  const count = (r: { data: unknown[] | null; error: { code?: string } | null }, what: string) => {
    if (r.error && !isMissing(r.error)) console.error(`cleanup: ${what} failed`, r.error);
    return r.data?.length ?? 0;
  };

  // Abandoned rooms: nobody has moved for a day.
  report.rooms += count(await db().from("rooms").delete().lt("updated_at", iso(ABANDONED_AFTER)).select("code"), "old rooms");

  // Finished rooms: look at the idle ones and delete those whose game is over.
  const idle = await db().from("rooms").select("code, game, state").lt("updated_at", iso(FINISHED_AFTER)).limit(300)
    .returns<{ code: string; game: string; state: unknown }[]>();
  const done = (idle.data ?? []).filter((r) => isDone(r.game, r.state)).map((r) => r.code);
  if (done.length) {
    report.rooms += count(await db().from("rooms").delete().in("code", done).select("code"), "finished rooms");
  }

  // The per-move table is no longer written to; clear whatever is left in it.
  report.moves = count(await db().from("moves").delete().gt("id", 0).select("id"), "moves");
  report.invites = count(await db().from("invites").delete().lt("created_at", iso(INVITE_AFTER)).select("id"), "invites");
  report.replays = count(
    await db().from("results").update({ replay: null }).lt("finished_at", iso(REPLAY_AFTER)).not("replay", "is", null).select("id"),
    "old replays",
  );
  return report;
}

// Serverless has no background jobs, so this piggybacks on ordinary requests,
// at most once every ten minutes per server instance.
let lastRun = 0;
export async function cleanupNowAndThen() {
  if (Date.now() - lastRun < 10 * 60_000) return;
  lastRun = Date.now();
  try {
    const r = await cleanup();
    if (r.rooms + r.moves + r.invites + r.replays > 0) console.log("cleanup", r);
  } catch (e) {
    console.error("cleanup failed", e);
  }
}
