import { z } from "zod";
import { getEngine } from "@/games";
import { begin, BOT_ID, botTurns, newRoomMeta, wrap, type RoomOptions } from "@/games/runner";
import { profileSchema, resolvePlayer } from "@/lib/accounts";
import { db, handle, HttpError, identity, parseBody, playerRow, randomCode } from "@/lib/server";

const optionsSchema = z.object({
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
  private: z.boolean().default(false),
  bot: z.enum(["easy", "hard"]).nullable().default(null),
  rules: z.record(z.string(), z.boolean()).default({}),
});
const bodySchema = profileSchema.extend({ game: z.string(), options: optionsSchema.optional() });

/** Create a room; the creator takes seat 0. Against the computer the game starts at once. */
export function POST(req: Request) {
  return handle(async () => {
    const who = identity(req);
    const body = await parseBody(req, bodySchema);
    const engine = getEngine(body.game);
    if (!engine) throw new HttpError(400, "Unknown game");
    const profile = await resolvePlayer(who, body);

    const asked = optionsSchema.parse(body.options ?? {});
    const known = new Set((engine.rules ?? []).map((r) => r.id));
    const options: RoomOptions = {
      ...asked,
      private: asked.private && !asked.bot,
      rules: Object.fromEntries(Object.entries(asked.rules).filter(([k, on]) => known.has(k) && on)),
    };
    if (options.bot && !engine.botMove) throw new HttpError(400, "The computer can't play this game yet");
    if (options.private && !profile.account) throw new HttpError(403, "Log in to make a private room");

    let state = wrap(null, newRoomMeta(options));
    if (options.bot) {
      const started = begin(engine, [who.id, BOT_ID], Math.floor(Math.random() * 2 ** 31), newRoomMeta(options), Date.now());
      const r = botTurns(engine, started.state, started.meta, Date.now(), Math.random);
      state = wrap(r.state, r.meta);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await db().from("rooms").insert({ code, game: body.game, state, version: options.bot ? 1 : 0 });
      if (error?.code === "23505") continue; // code collision, try another
      if (error) throw error;
      const rows = [await playerRow(code, who, profile, 0)];
      if (options.bot) {
        rows.push(await playerRow(code, { id: BOT_ID, secret: "-" }, { name: "Computer", avatar: "🤖", color: "slate" }, 1));
      }
      const { error: pErr } = await db().from("room_players").insert(rows);
      if (pErr) throw pErr;
      return Response.json({ code });
    }
    throw new HttpError(503, "Could not allocate a room code");
  });
}
