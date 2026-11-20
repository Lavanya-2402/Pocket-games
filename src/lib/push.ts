import { sendNotification, setVapidDetails } from "web-push";
import { db, isMissing } from "./server";

/**
 * Phone notifications (web push). Server-only.
 * Needs a key pair: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (see README).
 * Without them, or before migration 003, everything here quietly does nothing.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

/** Who push services may contact about this app: a setting, else the site's own address. */
function subject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return site ? `https://${site}` : "https://localhost";
}

export const pushConfigured = () => !!publicKey && !!privateKey;

let ready = false;
/** Sign outgoing notifications with this app's key pair (set up on first use). */
function prepare() {
  if (!ready) {
    setVapidDetails(subject(), publicKey!, privateKey!);
    ready = true;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the notification goes, e.g. /r/ABCD. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
}

interface Sub { endpoint: string; p256dh: string; auth: string }

/** Notify every phone this account has switched notifications on for. Never throws. */
export async function sendPush(accountId: string, message: PushMessage) {
  if (!pushConfigured()) return 0;
  try {
    const { data, error } = await db().from("push_subscriptions")
      .select("endpoint, p256dh, auth").eq("account_id", accountId).returns<Sub[]>();
    if (error) {
      if (!isMissing(error)) console.error("push lookup failed", error);
      return 0;
    }
    const results = await Promise.all(data.map(async (s) => {
      try {
        prepare();
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 15 * 60, urgency: "high" }, // an invite is only useful for a few minutes
        );
        return true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: that phone unsubscribed or reinstalled — forget it.
        if (status === 404 || status === 410) await db().from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.error("push failed", status ?? e);
        return false;
      }
    }));
    return results.filter(Boolean).length;
  } catch (e) {
    console.error("push failed", e);
    return 0;
  }
}
