import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEngine } from "@/games";
import { BOT_ID, botTurns, outcome, unwrap, waitingOn, wrap, type Meta } from "@/games/runner";

let admin: SupabaseClient | null = null;

/** Server-only client using the secret key. Never import this from client code. */
export function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new HttpError(500, "Supabase env vars are not set");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Server error" }, { status: 500 });
  });
}

const identitySchema = z.object({ id: z.uuid(), secret: z.string().min(16).max(100) });

export function identity(req: Request) {
  const parsed = identitySchema.safeParse({
    id: req.headers.get("x-player-id"),
    secret: req.headers.get("x-player-secret"),
  });
  if (!parsed.success || parsed.data.id === BOT_ID) throw new HttpError(401, "Missing player identity");
  return parsed.data;
}

export const nameSchema = z.string().trim().min(1, "Enter a name").max(20, "Name is too long (20 max)");
export const codeSchema = z.string().regex(/^[A-Z]{4}$/);

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  return parsed.data;
}

/** Send one realtime message to everyone subscribed to `topic`. */
export async function notify(topic: string, event: string, payload: object) {
  const ch = db().channel(topic);
  const res = await ch.httpSend(event, payload);
  if (!res.success) console.error("notify failed", topic, res);
  await db().removeChannel(ch);
}

/**
 * Ping everyone in the room. For games with no hidden info, the public view rides
 * along so phones can update instantly without a refetch round trip.
 */
export function broadcast(room: RoomRow, players: PlayerRow[]) {
  const engine = getEngine(room.game)!;
  const payload = engine.hiddenInfo
    ? { version: room.version }
    : { version: room.version, view: roomView(room, players, null) };
  return notify(`room:${room.code}`, "update", payload);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** PostgREST / Postgres codes for "that table or column doesn't exist (yet)". */
export function isMissing(error: { code?: string } | null) {
  return !!error && ["PGRST205", "PGRST204", "42P01", "42703"].includes(error.code ?? "");
}

export const SETUP_MSG = "Accounts aren't set up yet — run supabase/migrations/002_accounts.sql in Supabase";

// Avatar/colour columns arrive with migration 002. Until it's run, rooms still work
// without them. A "yes" is remembered; a "no" is re-checked at most every 30 s.
let profileCols = false;
let probedAt = 0;
export async function hasProfileCols() {
  if (profileCols) return true;
  if (Date.now() - probedAt < 30_000) return false;
  probedAt = Date.now();
  const { error } = await db().from("room_players").select("avatar, color").limit(1);
  profileCols = !error;
  return profileCols;
}

// The results table arrives with migration 003. Same idea as above: remember a "yes".
let resultsTable = false;
let resultsProbedAt = 0;
export async function hasResults() {
  if (resultsTable) return true;
  if (Date.now() - resultsProbedAt < 30_000) return false;
  resultsProbedAt = Date.now();
  const { error } = await db().from("results").select("id").limit(1);
  resultsTable = !error;
  return resultsTable;
}

/** True if this id + secret is a logged-in account session. */
export async function validSession(who: { id: string; secret: string }) {
  const { data, error } = await db()
    .from("sessions")
    .select("account_id")
    .eq("token_hash", sha256(who.secret))
    .eq("account_id", who.id)
    .maybeSingle();
  if (error && !isMissing(error)) throw error;
  return !!data;
}

export interface RoomRow {
  code: string;
  game: string;
  state: unknown;
  version: number;
}

export interface PlayerRow {
  player_id: string;
  secret: string;
  name: string;
  seat: number | null;
  avatar?: string | null;
  color?: string | null;
}

/** Room + players in a single round trip. */
export async function loadRoom(code: string) {
  const [cols] = await Promise.all([hasProfileCols(), hasResults()]);
  const extra = cols ? ", avatar, color" : "";
  const { data, error } = await db()
    .from("rooms")
    .select(`code, game, state, version, room_players(player_id, secret, name, seat, joined_at${extra})`)
    .eq("code", code)
    .maybeSingle<RoomRow & { room_players: (PlayerRow & { joined_at: string })[] }>();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Room not found");
  const { room_players, ...room } = data;
  const players = room_players
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    .map((p): PlayerRow => ({
      player_id: p.player_id, secret: p.secret, name: p.name, seat: p.seat,
      avatar: p.avatar ?? null, color: p.color ?? null,
    }));
  return { room: room as RoomRow, players };
}

/**
 * Throws unless the caller owns this seat. Returns their row, or null if they never joined.
 * Room secrets are stored hashed. A logged-in account may also come back from another
 * phone (different session token), so a valid session for the same account id is accepted.
 */
export async function authPlayer(players: PlayerRow[], who: { id: string; secret: string }) {
  const me = players.find((p) => p.player_id === who.id);
  if (!me) return null;
  if (me.secret === sha256(who.secret) || me.secret === who.secret) return me; // 2nd form: rooms from before hashing
  if (await validSession(who)) return me;
  throw new HttpError(403, "Identity mismatch");
}

/** The row to insert for a player taking part in a room. */
export async function playerRow(
  code: string,
  who: { id: string; secret: string },
  profile: { name: string; avatar: string; color: string },
  seat: number | null,
) {
  const base = { room_code: code, player_id: who.id, secret: sha256(who.secret), name: profile.name, seat };
  return (await hasProfileCols()) ? { ...base, avatar: profile.avatar, color: profile.color } : base;
}

/** Atomically replace state if nobody else changed it since we read it. */
export async function saveState(code: string, expectedVersion: number, state: unknown) {
  const { data, error } = await db()
    .from("rooms")
    .update({ state, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq("code", code)
    .eq("version", expectedVersion)
    .select("version");
  if (error) throw error;
  if (!data?.length) throw new HttpError(409, "Someone moved first — refresh and retry");
  return expectedVersion + 1;
}

/**
 * Save a changed game, then tell everyone. Shared by every route that changes a room:
 * lets the computer take its turns first, and files the result when a game has just ended.
 */
export async function commit(
  room: RoomRow, players: PlayerRow[], next: { state: unknown; meta: Meta }, before: Meta,
) {
  const engine = getEngine(room.game)!;
  // Step-paced games leave the computer's move for the phone to ask for a moment later.
  const r = next.state === null || engine.botPace === "step"
    ? next
    : botTurns(engine, next.state, next.meta, Date.now(), Math.random);
  const stored = wrap(r.state, r.meta);
  const version = await saveState(room.code, room.version, stored);
  const saved: RoomRow = { ...room, state: stored, version };
  const jobs: Promise<unknown>[] = [broadcast(saved, players)];
  if (r.meta.resultId && r.meta.resultId !== before.resultId) jobs.push(recordResult(saved, players, r.state, r.meta));
  await Promise.all(jobs);
  return saved;
}

/** File a finished game in the results table (win/loss records, leaderboards, replays). */
async function recordResult(room: RoomRow, players: PlayerRow[], state: unknown, meta: Meta) {
  const engine = getEngine(room.game)!;
  const order = meta.order ?? (state as { players: [string, string] }).players;
  const w = outcome(engine, state, meta);
  const { error } = await db().from("results").insert({
    id: meta.resultId,
    room_code: room.code,
    game: room.game,
    p0: order[0],
    p1: order[1],
    names: order.map((id) => players.find((p) => p.player_id === id)?.name ?? "Player"),
    winner: w === "draw" ? null : w,
    forfeit: meta.forfeit !== null,
    vs_bot: order.includes(BOT_ID),
    moves: meta.log.length,
    replay: { seed: meta.seed, order, rules: meta.options.rules, log: meta.log },
  });
  // Before migration 003 the table doesn't exist; the game itself is unaffected.
  if (error && !isMissing(error) && error.code !== "23505") console.error("result not saved", error);
}

export function seatedIds(players: PlayerRow[]): [string, string] | null {
  const a = players.find((p) => p.seat === 0);
  const b = players.find((p) => p.seat === 1);
  return a && b ? [a.player_id, b.player_id] : null;
}

/** What one viewer receives. Secrets never leave the server. */
export function roomView(room: RoomRow, players: PlayerRow[], viewerId: string | null) {
  const engine = getEngine(room.game)!;
  const me = players.find((p) => p.player_id === viewerId);
  const { state, meta } = unwrap(room.state);
  const live = state !== null && state !== undefined;
  return {
    code: room.code,
    game: room.game,
    gameName: engine.name,
    version: room.version,
    players: players
      .filter((p) => p.seat !== null)
      .map((p) => ({
        id: p.player_id, name: p.name, seat: p.seat,
        avatar: p.avatar ?? null, color: p.color ?? null,
      })),
    spectators: players.filter((p) => p.seat === null).length,
    you: me ? { id: me.player_id, seat: me.seat } : null,
    state: live ? engine.viewFor(state, viewerId) : null,
    turn: live && !meta.forfeit ? engine.turn(state) : null,
    winner: live ? outcome(engine, state, meta) : null,
    options: meta.options,
    series: meta.series,
    /** Id of the finished game's replay, once it has ended (and replays are being kept). */
    replayId: live && resultsTable ? meta.resultId : null,
    clock: {
      deadline: meta.deadline,
      limit: live ? engine.timeLimit(state) : 0,
      serverNow: Date.now(),
      waitingOn: live && !meta.forfeit ? waitingOn(engine, state) : [],
      misses: meta.misses,
      forfeit: meta.forfeit,
    },
  };
}

export type RoomView = ReturnType<typeof roomView>;

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I / O to avoid confusion
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => LETTERS[b % LETTERS.length]).join("");
}
