import { cleanup } from "@/lib/cleanup";
import { handle, HttpError } from "@/lib/server";

/**
 * Housekeeping endpoint, called once a day by Vercel Cron (see vercel.json).
 * If CRON_SECRET is set, Vercel sends it and anyone else is refused. Without it the
 * endpoint is open, which is harmless: it only ever deletes data that is already stale.
 */
export function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Not allowed");
    return Response.json(await cleanup());
  });
}
