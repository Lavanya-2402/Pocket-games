import { z } from "zod";
import { hashPassword, parseForm, passwordSchema, requireAccount, verifyPassword } from "@/lib/accounts";
import { db, handle, HttpError, identity, sha256 } from "@/lib/server";

const bodySchema = z.object({ current: z.string().min(1, "Enter your current password").max(72), next: passwordSchema });

/** Change password while logged in. Every other phone is logged out; this one stays in. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    const { current, next } = await parseForm(req, bodySchema);
    const { data, error } = await db().from("accounts").select("password_hash").eq("id", me.id)
      .single<{ password_hash: string }>();
    if (error) throw error;
    if (!verifyPassword(current, data.password_hash)) throw new HttpError(403, "Your current password is wrong");
    if (current === next) throw new HttpError(400, "Choose a different password");

    const { error: upErr } = await db().from("accounts")
      .update({ password_hash: hashPassword(next), reset_code: null, failed_logins: 0, locked_until: null })
      .eq("id", me.id);
    if (upErr) throw upErr;
    await db().from("sessions").delete().eq("account_id", me.id).neq("token_hash", sha256(identity(req).secret));
    return Response.json({ ok: true });
  });
}
