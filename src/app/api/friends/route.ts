import { z } from "zod";
import { getEngine } from "@/games";
import { ACCOUNT_COLS, publicAccount, requireAccount, usernameSchema, type Account } from "@/lib/accounts";
import { sendPush } from "@/lib/push";
import { codeSchema, db, handle, HttpError, notify, parseBody } from "@/lib/server";

const INVITE_MINUTES = 15;

interface FriendRow { account_id: string; friend_id: string; status: "pending" | "accepted" }
interface InviteRow { id: number; from_id: string; room_code: string; game: string; created_at: string }

/** Friends, pending requests (both ways) and recent room invites. */
async function social(me: Account) {
  const since = new Date(Date.now() - INVITE_MINUTES * 60_000).toISOString();
  const [rows, inv] = await Promise.all([
    db().from("friends").select("account_id, friend_id, status")
      .or(`account_id.eq.${me.id},friend_id.eq.${me.id}`).returns<FriendRow[]>(),
    db().from("invites").select("id, from_id, room_code, game, created_at")
      .eq("to_id", me.id).gte("created_at", since).order("created_at", { ascending: false }).limit(5)
      .returns<InviteRow[]>(),
  ]);
  if (rows.error) throw rows.error;
  if (inv.error) throw inv.error;

  const other = (r: FriendRow) => (r.account_id === me.id ? r.friend_id : r.account_id);
  const ids = [...new Set([...rows.data.map(other), ...inv.data.map((i) => i.from_id)])];
  const people = new Map<string, ReturnType<typeof publicAccount>>();
  if (ids.length) {
    const { data, error } = await db().from("accounts").select(ACCOUNT_COLS).in("id", ids).returns<Account[]>();
    if (error) throw error;
    data.forEach((a) => people.set(a.id, publicAccount(a)));
  }
  const pick = (f: (r: FriendRow) => boolean) =>
    rows.data.filter(f).map((r) => people.get(other(r))).filter((p) => !!p)
      .sort((a, b) => a!.name.localeCompare(b!.name));

  // Newest invite per room only.
  const seen = new Set<string>();
  const invites = inv.data
    .filter((i) => people.has(i.from_id) && !seen.has(i.room_code) && seen.add(i.room_code))
    .map((i) => ({
      id: i.id, from: people.get(i.from_id)!, code: i.room_code,
      gameName: getEngine(i.game)?.name ?? "a game", at: Date.parse(i.created_at),
    }));

  return {
    friends: pick((r) => r.status === "accepted"),
    incoming: pick((r) => r.status === "pending" && r.friend_id === me.id),
    outgoing: pick((r) => r.status === "pending" && r.account_id === me.id),
    invites,
  };
}

export function GET(req: Request) {
  return handle(async () => Response.json(await social(await requireAccount(req))));
}

const uuid = z.uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), username: usernameSchema.optional(), id: uuid.optional() }),
  z.object({ action: z.literal("accept"), id: uuid }),
  z.object({ action: z.literal("remove"), id: uuid }), // also declines / cancels a request
  z.object({ action: z.literal("invite"), id: uuid, code: codeSchema }),
  z.object({ action: z.literal("dismiss"), invite: z.number().int() }),
]);

const ping = (id: string) => notify(`user:${id}`, "ping", {}).catch(() => {});

export function POST(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    const body = await parseBody(req, bodySchema);
    const pair = (id: string) =>
      `and(account_id.eq.${me.id},friend_id.eq.${id}),and(account_id.eq.${id},friend_id.eq.${me.id})`;

    if (body.action === "add") {
      if (!body.username && !body.id) throw new HttpError(400, "Who do you want to add?");
      if (body.username === me.username || body.id === me.id) throw new HttpError(400, "That's you!");
      const lookup = db().from("accounts").select("id");
      const { data: target, error } = await (body.id ? lookup.eq("id", body.id) : lookup.eq("username", body.username!)).maybeSingle();
      if (error) throw error;
      if (!target) {
        throw new HttpError(404, body.id ? "They're playing as a guest, so they can't be added yet" : `No player called @${body.username}`);
      }
      const { data: existing, error: exErr } = await db().from("friends").select("account_id, status")
        .or(pair(target.id)).returns<Pick<FriendRow, "account_id" | "status">[]>();
      if (exErr) throw exErr;
      const row = existing[0];
      if (row?.status === "accepted") throw new HttpError(409, "You're already friends");
      if (row && row.account_id === me.id) throw new HttpError(409, "Request already sent");
      if (row) {
        // They already asked us — adding them back accepts it.
        await db().from("friends").update({ status: "accepted" }).eq("account_id", target.id).eq("friend_id", me.id);
      } else {
        const { error: insErr } = await db().from("friends").insert({ account_id: me.id, friend_id: target.id });
        if (insErr) throw insErr;
        await sendPush(target.id, {
          title: "New friend request",
          body: `${me.display_name} (@${me.username}) wants to be friends`,
          url: "/",
          tag: `friend-${me.id}`,
        });
      }
      await ping(target.id);
    } else if (body.action === "accept") {
      const { data, error } = await db().from("friends").update({ status: "accepted" })
        .eq("account_id", body.id).eq("friend_id", me.id).eq("status", "pending").select("account_id");
      if (error) throw error;
      if (!data.length) throw new HttpError(404, "That request is gone");
      await ping(body.id);
    } else if (body.action === "remove") {
      const { error } = await db().from("friends").delete().or(pair(body.id));
      if (error) throw error;
      await ping(body.id);
    } else if (body.action === "invite") {
      const [fr, room] = await Promise.all([
        db().from("friends").select("status").or(pair(body.id)).eq("status", "accepted").limit(1),
        db().from("rooms").select("game, room_players(player_id)").eq("code", body.code)
          .maybeSingle<{ game: string; room_players: { player_id: string }[] }>(),
      ]);
      if (fr.error) throw fr.error;
      if (room.error) throw room.error;
      if (!fr.data.length) throw new HttpError(403, "You can only invite friends");
      if (!room.data?.room_players.some((p) => p.player_id === me.id)) throw new HttpError(403, "Join the room first");
      const { error } = await db().from("invites")
        .insert({ to_id: body.id, from_id: me.id, room_code: body.code, game: room.data.game });
      if (error) throw error;
      await Promise.all([
        ping(body.id),
        sendPush(body.id, {
          title: `${me.display_name} invited you to play`,
          body: `${getEngine(room.data.game)?.name ?? "A game"} — tap to join`,
          url: `/r/${body.code}`,
          tag: `invite-${body.code}`,
        }),
      ]);
    } else {
      await db().from("invites").delete().eq("id", body.invite).eq("to_id", me.id);
    }
    return Response.json(await social(me));
  });
}
