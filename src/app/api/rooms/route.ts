import { getEngine } from "@/games";
import { profileSchema, resolvePlayer } from "@/lib/accounts";
import { db, handle, HttpError, identity, parseBody, playerRow, randomCode } from "@/lib/server";
import { z } from "zod";

const bodySchema = profileSchema.extend({ game: z.string() });

/** Create a room; the creator takes seat 0. */
export function POST(req: Request) {
  return handle(async () => {
    const who = identity(req);
    const body = await parseBody(req, bodySchema);
    if (!getEngine(body.game)) throw new HttpError(400, "Unknown game");
    const profile = await resolvePlayer(who, body);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await db().from("rooms").insert({ code, game: body.game });
      if (error?.code === "23505") continue; // code collision, try another
      if (error) throw error;
      const { error: pErr } = await db().from("room_players").insert(await playerRow(code, who, profile, 0));
      if (pErr) throw pErr;
      return Response.json({ code });
    }
    throw new HttpError(503, "Could not allocate a room code");
  });
}
