import { z } from "zod";
import { getEngine } from "@/games";
import {
  authPlayer, broadcast, codeSchema, db, handle, HttpError, identity, loadRoom,
  parseBody, roomView, saveState,
} from "@/lib/server";

const bodySchema = z.object({ move: z.unknown(), version: z.number().int() });

/** Server-authoritative move: validate → apply → save (optimistic lock) → log → broadcast. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/move">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const body = await parseBody(req, bodySchema);

    const { room, players } = await loadRoom(code);
    const me = authPlayer(players, who);
    if (!me || me.seat === null) throw new HttpError(403, "Spectators can't move");
    if (!room.state) throw new HttpError(409, "Waiting for an opponent");
    if (body.version !== room.version) throw new HttpError(409, "Board changed — refreshing");

    const engine = getEngine(room.game)!;
    const parsed = engine.moveSchema.safeParse(body.move);
    if (!parsed.success) throw new HttpError(400, "Invalid move");
    const problem = engine.validate(room.state, parsed.data, who.id);
    if (problem) throw new HttpError(422, problem);

    const state = engine.apply(room.state, parsed.data, who.id);
    const version = await saveState(code, room.version, state);
    const next = { ...room, state, version };
    // Log and notify in parallel — one round trip instead of two.
    await Promise.all([
      db().from("moves").insert({ room_code: code, player_id: who.id, move: parsed.data, version })
        .then(({ error }) => error && console.error("move log failed", error)),
      broadcast(next, players),
    ]);

    return Response.json(roomView(next, players, who.id));
  });
}
