import { z } from "zod";
import { ACCOUNT_COLS, loginPayload, setupError, usernameSchema, verifyPassword, type Account } from "@/lib/accounts";
import { db, handle, HttpError, parseBody } from "@/lib/server";

const bodySchema = z.object({ username: usernameSchema, password: z.string().min(1).max(72) });
const MAX_TRIES = 8;
const LOCK_MINUTES = 5;
const WRONG = "Wrong username or password";

/** Log in. After several wrong passwords in a row the account locks for a few minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const { username, password } = await parseBody(req, bodySchema);
    const { data, error } = await db()
      .from("accounts")
      .select(`${ACCOUNT_COLS}, password_hash, failed_logins, locked_until`)
      .eq("username", username)
      .maybeSingle<Account & { password_hash: string; failed_logins: number; locked_until: string | null }>();
    if (error) setupError(error);
    if (!data) throw new HttpError(401, WRONG);

    if (data.locked_until && new Date(data.locked_until) > new Date()) {
      throw new HttpError(429, `Too many tries — wait ${LOCK_MINUTES} minutes and try again`);
    }
    if (!verifyPassword(password, data.password_hash)) {
      const fails = data.failed_logins + 1;
      const lock = fails >= MAX_TRIES;
      await db().from("accounts").update({
        failed_logins: lock ? 0 : fails,
        locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      }).eq("id", data.id);
      throw new HttpError(401, WRONG);
    }
    if (data.failed_logins) await db().from("accounts").update({ failed_logins: 0, locked_until: null }).eq("id", data.id);
    return Response.json(await loginPayload(data));
  });
}
