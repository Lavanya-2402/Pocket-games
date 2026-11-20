import { z } from "zod";
import { ACCOUNT_COLS, isOwner, profileSchema, publicAccount, requireAccount, type Account } from "@/lib/accounts";
import { cleanAvatar, cleanColor } from "@/lib/profile";
import { db, handle, identity, parseBody, sha256 } from "@/lib/server";

/** The account this phone is logged in as (401 if it isn't). */
export function GET(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    return Response.json({ account: publicAccount(me), owner: isOwner(me) });
  });
}

const bodySchema = z.union([profileSchema, z.object({ logout: z.literal(true) })]);

/** Update name / avatar / colour, or log this phone out. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    const body = await parseBody(req, bodySchema);
    if ("logout" in body) {
      await db().from("sessions").delete().eq("token_hash", sha256(identity(req).secret));
      return Response.json({ ok: true });
    }
    const { data, error } = await db()
      .from("accounts")
      .update({ display_name: body.name, avatar: cleanAvatar(body.avatar), color: cleanColor(body.color) })
      .eq("id", me.id)
      .select(ACCOUNT_COLS)
      .single<Account>();
    if (error) throw error;
    return Response.json({ account: publicAccount(data) });
  });
}
