import { z } from "zod";
import { getEngine } from "@/games";
import { db, handle, HttpError, identity, nameSchema, parseBody, randomCode } from "@/lib/server";

const bodySchema = z.object({ game: z.string(), name: nameSchema });

/** Create a room; the creator takes seat 0. */
export function POST(req: Request) {
  return handle(async () => {
    const who = identity(req);
    const { game, name } = await parseBody(req, bodySchema);
    if (!getEngine(game)) throw new HttpError(400, "Unknown game");

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await db().from("rooms").insert({ code, game });
      if (error?.code === "23505") continue; // code collision, try another
      if (error) throw error;
      const { error: pErr } = await db()
        .from("room_players")
        .insert({ room_code: code, player_id: who.id, secret: who.secret, name, seat: 0 });
      if (pErr) throw pErr;
      return Response.json({ code });
    }
    throw new HttpError(503, "Could not allocate a room code");
  });
}
