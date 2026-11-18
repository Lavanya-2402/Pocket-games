import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEngine } from "@/games";

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
  if (!parsed.success) throw new HttpError(401, "Missing player identity");
  return parsed.data;
}

export const nameSchema = z.string().trim().min(1).max(20);
export const codeSchema = z.string().regex(/^[A-Z]{4}$/);

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  return parsed.data;
}

export async function broadcast(code: string, version: number) {
  const ch = db().channel(`room:${code}`);
  const res = await ch.httpSend("update", { version });
  if (!res.success) console.error("broadcast failed", res);
  await db().removeChannel(ch);
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
}

export async function loadRoom(code: string) {
  const { data: room, error } = await db()
    .from("rooms")
    .select("code, game, state, version")
    .eq("code", code)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  if (!room) throw new HttpError(404, "Room not found");
  const { data: players, error: pErr } = await db()
    .from("room_players")
    .select("player_id, secret, name, seat")
    .eq("room_code", code)
    .order("joined_at")
    .returns<PlayerRow[]>();
  if (pErr) throw pErr;
  return { room, players };
}

/** Throws unless the caller's secret matches. Returns their row, or null if they never joined. */
export function authPlayer(players: PlayerRow[], who: { id: string; secret: string }) {
  const me = players.find((p) => p.player_id === who.id);
  if (me && me.secret !== who.secret) throw new HttpError(403, "Identity mismatch");
  return me ?? null;
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

export function seatedIds(players: PlayerRow[]): [string, string] | null {
  const a = players.find((p) => p.seat === 0);
  const b = players.find((p) => p.seat === 1);
  return a && b ? [a.player_id, b.player_id] : null;
}

/** What one viewer receives. Secrets never leave the server. */
export function roomView(room: RoomRow, players: PlayerRow[], viewerId: string | null) {
  const engine = getEngine(room.game)!;
  const me = players.find((p) => p.player_id === viewerId);
  return {
    code: room.code,
    game: room.game,
    gameName: engine.name,
    version: room.version,
    players: players
      .filter((p) => p.seat !== null)
      .map((p) => ({ id: p.player_id, name: p.name, seat: p.seat })),
    spectators: players.filter((p) => p.seat === null).length,
    you: me ? { id: me.player_id, seat: me.seat } : null,
    state: room.state ? engine.viewFor(room.state, viewerId) : null,
    turn: room.state ? engine.turn(room.state) : null,
    winner: room.state ? engine.winner(room.state) : null,
  };
}

export type RoomView = ReturnType<typeof roomView>;

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I / O to avoid confusion
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => LETTERS[b % LETTERS.length]).join("");
}
