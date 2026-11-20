import { randomInt } from "node:crypto";
import { z } from "zod";
import { isOwner, requireAccount } from "@/lib/accounts";
import { db, handle, HttpError, parseBody } from "@/lib/server";

/** Only accounts named in the OWNER_USERNAMES setting may use these. */
async function requireOwner(req: Request) {
  const me = await requireAccount(req);
  if (!isOwner(me)) throw new HttpError(403, "This page is only for the game owner");
  return me;
}

interface Row {
  id: string; username: string; display_name: string; avatar: string; color: string;
  created_at: string; reset_code: string | null; locked_until: string | null;
  sessions: { count: number }[];
}

/** Every account, newest first. Passwords are not readable — only whether a reset code is waiting. */
export function GET(req: Request) {
  return handle(async () => {
    await requireOwner(req);
    const { data, error } = await db().from("accounts")
      .select("id, username, display_name, avatar, color, created_at, reset_code, locked_until, sessions(count)")
      .order("created_at", { ascending: false }).limit(500).returns<Row[]>();
    if (error) throw error;
    return Response.json({
      accounts: data.map((a) => ({
        id: a.id,
        username: a.username,
        name: a.display_name,
        avatar: a.avatar,
        color: a.color,
        joined: Date.parse(a.created_at),
        resetCode: a.reset_code, // the owner set this, so the owner may see it again
        locked: !!a.locked_until && Date.parse(a.locked_until) > Date.now(),
        phones: a.sessions[0]?.count ?? 0,
      })),
    });
  });
}

const bodySchema = z.object({ action: z.enum(["reset", "clear", "unlock", "logout", "delete"]), id: z.uuid() });

export function POST(req: Request) {
  return handle(async () => {
    const me = await requireOwner(req);
    const { action, id } = await parseBody(req, bodySchema);
    const accounts = () => db().from("accounts");

    if (action === "reset") {
      // A one-time code the player types under Profile → Account → Forgot password.
      const code = String(randomInt(100000, 1000000));
      const { error } = await accounts().update({ reset_code: code, failed_logins: 0, locked_until: null }).eq("id", id);
      if (error) throw error;
      return Response.json({ code });
    }
    if (action === "clear") await accounts().update({ reset_code: null }).eq("id", id);
    if (action === "unlock") await accounts().update({ failed_logins: 0, locked_until: null }).eq("id", id);
    if (action === "logout") await db().from("sessions").delete().eq("account_id", id);
    if (action === "delete") {
      if (id === me.id) throw new HttpError(400, "You can't delete your own account from here");
      const { error } = await accounts().delete().eq("id", id);
      if (error) throw error;
    }
    return Response.json({ ok: true });
  });
}
