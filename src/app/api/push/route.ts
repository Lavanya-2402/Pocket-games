import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { pushConfigured, sendPush } from "@/lib/push";
import { db, handle, HttpError, isMissing, parseBody } from "@/lib/server";

const NOT_READY = "Notifications aren't set up on this server yet";

/** Push services browsers actually use. Anything else is refused, so nobody can make the server call arbitrary sites. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",                // Chrome, Edge, Android
  ".push.services.mozilla.com",        // Firefox
  ".push.apple.com",                   // Safari, iPhone
  ".notify.windows.com",               // older Edge / Windows
];
function isPushService(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}

const bodySchema = z.union([
  z.object({
    subscribe: z.object({
      // Only real push services: the server will be sending requests to this address.
      endpoint: z.url().max(1000).refine(isPushService, "Not a known push service"),
      keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(10).max(100) }),
    }),
  }),
  z.object({ unsubscribe: z.string().max(1000) }),
  z.object({ test: z.literal(true) }),
]);

/** Is this server able to send notifications, and how many phones has this account enabled? */
export function GET(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    if (!pushConfigured()) return Response.json({ available: false, phones: 0 });
    const { count, error } = await db().from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true }).eq("account_id", me.id);
    if (error) return Response.json({ available: false, phones: 0 }); // table not created yet
    return Response.json({ available: true, phones: count ?? 0 });
  });
}

/** Turn notifications on or off for this phone, or send yourself a test one. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);
    const body = await parseBody(req, bodySchema);
    if (!pushConfigured()) throw new HttpError(503, NOT_READY);

    if ("subscribe" in body) {
      const { endpoint, keys } = body.subscribe;
      const { error } = await db().from("push_subscriptions")
        .upsert({ endpoint, account_id: me.id, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
      if (error) throw new HttpError(503, isMissing(error) ? `${NOT_READY} — run supabase/migrations/003_results_and_push.sql` : "Couldn't save that");
      return Response.json({ ok: true });
    }
    if ("unsubscribe" in body) {
      await db().from("push_subscriptions").delete().eq("endpoint", body.unsubscribe).eq("account_id", me.id);
      return Response.json({ ok: true });
    }
    const sent = await sendPush(me.id, { title: "Pocket Games", body: "Notifications are working 🎉", url: "/", tag: "test" });
    return Response.json({ sent });
  });
}
