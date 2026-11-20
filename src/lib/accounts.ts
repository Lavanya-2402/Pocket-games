import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cleanAvatar, cleanColor, type Profile } from "./profile";
import { db, HttpError, identity, isMissing, nameSchema, SETUP_MSG, sha256 } from "./server";

/** Server-only account helpers. Passwords are stored as scrypt hashes, never as text. */

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,16}$/, "Username: 3–16 letters, numbers or _");
export const passwordSchema = z.string().min(6, "Password needs at least 6 characters").max(72);
export const profileSchema = z.object({
  name: nameSchema,
  avatar: z.string().max(16).optional(),
  color: z.string().max(16).optional(),
});

export interface Account {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  color: string;
}
export const ACCOUNT_COLS = "id, username, display_name, avatar, color";

const N = 16384;

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = scryptSync(password, Buffer.from(salt, "base64"), want.length, { N: Number(n) });
  return timingSafeEqual(want, got);
}

/** Constant-time string compare (for reset codes). */
export function sameText(a: string, b: string) {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

/** Start a session on this phone. The token goes to the phone; only its hash is stored. */
export async function newSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const { error } = await db().from("sessions").insert({ token_hash: sha256(token), account_id: accountId });
  if (error) throw error;
  return token;
}

export const publicAccount = (a: Account) => ({
  id: a.id, username: a.username, name: a.display_name, avatar: a.avatar, color: a.color,
});

/** What the phone needs after signing up / logging in. */
export async function loginPayload(a: Account) {
  return { id: a.id, secret: await newSession(a.id), account: publicAccount(a) };
}

export function setupError(error: { code?: string } | null): never {
  if (isMissing(error)) throw new HttpError(503, SETUP_MSG);
  throw error;
}

/** The logged-in account making this request, or 401. */
export async function requireAccount(req: Request): Promise<Account> {
  const who = identity(req);
  const { data, error } = await db()
    .from("sessions")
    .select(`accounts(${ACCOUNT_COLS})`)
    .eq("token_hash", sha256(who.secret))
    .eq("account_id", who.id)
    .maybeSingle();
  if (error) setupError(error);
  const account = (data as { accounts: Account | Account[] | null } | null)?.accounts;
  const a = Array.isArray(account) ? account[0] : account;
  if (!a) throw new HttpError(401, "Log in first");
  return a;
}

/**
 * Who is joining a room, and how they should appear.
 * - Guest ids use the name/avatar/colour their phone sent.
 * - Account ids must present a valid session and always use the saved profile,
 *   so nobody can sit down as someone else's account.
 */
export async function resolvePlayer(
  who: { id: string; secret: string }, guest: z.infer<typeof profileSchema>,
): Promise<Profile & { account: boolean }> {
  const fallback = { name: guest.name, avatar: cleanAvatar(guest.avatar), color: cleanColor(guest.color), account: false };
  const { data, error } = await db()
    .from("accounts")
    .select("display_name, avatar, color, sessions(token_hash)")
    .eq("id", who.id)
    .eq("sessions.token_hash", sha256(who.secret))
    .maybeSingle();
  if (error) {
    if (isMissing(error)) return fallback; // accounts not set up yet: everyone is a guest
    throw error;
  }
  if (!data) return fallback;
  const row = data as { display_name: string; avatar: string; color: string; sessions: unknown[] };
  if (!row.sessions?.length) throw new HttpError(401, "Your login expired — log in again");
  return { name: row.display_name, avatar: cleanAvatar(row.avatar), color: cleanColor(row.color), account: true };
}

/** True if the two accounts are accepted friends. */
export async function areFriends(a: string, b: string) {
  const { data, error } = await db()
    .from("friends")
    .select("status")
    .or(`and(account_id.eq.${a},friend_id.eq.${b}),and(account_id.eq.${b},friend_id.eq.${a})`)
    .eq("status", "accepted")
    .limit(1);
  if (error && !isMissing(error)) throw error;
  return !!data?.length;
}

/** Parse a form body; on failure, answer with the first field's own message. */
export async function parseForm<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const custom = issue && !/^(Invalid|Too|Expected)/i.test(issue.message);
  throw new HttpError(400, custom ? issue.message : "Check the form and try again");
}
