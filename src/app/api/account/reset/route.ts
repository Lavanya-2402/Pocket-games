import { z } from "zod";
import {
  ACCOUNT_COLS, hashPassword, loginPayload, parseForm, passwordSchema, sameText, setupError, usernameSchema,
  type Account,
} from "@/lib/accounts";
import { db, handle, HttpError } from "@/lib/server";

const bodySchema = z.object({
  username: usernameSchema,
  code: z.string().trim().min(1).max(40),
  password: passwordSchema,
});
const WRONG = "That username and reset code don't match";

/**
 * Forgot password. The game owner types a one-time code into the player's `reset_code`
 * cell in Supabase and tells them; the player uses it here to choose a new password.
 * The code is cleared, and every other phone is logged out.
 */
export function POST(req: Request) {
  return handle(async () => {

    const { username, code, password } = await parseForm(req, bodySchema);

    const { data, error } = await db()
      .from("accounts")
      .select(`${ACCOUNT_COLS}, reset_code`)
      .eq("username", username)
      .maybeSingle<Account & { reset_code: string | null }>();
    if (error) setupError(error);
    if (!data?.reset_code || !sameText(data.reset_code.trim(), code)) throw new HttpError(403, WRONG);

    const { error: upErr } = await db()
      .from("accounts")
      .update({ password_hash: hashPassword(password), reset_code: null, failed_logins: 0, locked_until: null })
      .eq("id", data.id);
    if (upErr) throw upErr;
    await db().from("sessions").delete().eq("account_id", data.id);
    return Response.json(await loginPayload(data));
  });
}
