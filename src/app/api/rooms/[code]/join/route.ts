import { z } from "zod";
import { getEngine } from "@/games";
import {
  authPlayer, broadcast, codeSchema, db, handle, HttpError, identity, loadRoom,
  nameSchema, parseBody, roomView, saveState, seatedIds,
} from "@/lib/server";

const bodySchema = z.object({ name: nameSchema });

/** Take a free seat (or spectate if full). Starts the game once both seats are filled. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const { name } = await parseBody(req, bodySchema);

    let { room, players } = await loadRoom(code);
    if (!authPlayer(players, who)) {
      const taken = new Set(players.map((p) => p.seat));
      let seat: number | null = !taken.has(0) ? 0 : !taken.has(1) ? 1 : null;
      let { error } = await db()
        .from("room_players")
        .insert({ room_code: code, player_id: who.id, secret: who.secret, name, seat });
      if (error?.code === "23505" && seat !== null) {
        // Someone grabbed the seat at the same instant — spectate instead.
        seat = null;
        ({ error } = await db()
          .from("room_players")
          .insert({ room_code: code, player_id: who.id, secret: who.secret, name, seat }));
      }
      if (error) throw error;
      ({ room, players } = await loadRoom(code));
    }

    const seated = seatedIds(players);
    if (!room.state && seated) {
      const engine = getEngine(room.game)!;
      const state = engine.init(seated, Math.floor(Math.random() * 2 ** 31));
      try {
        room = { ...room, state, version: await saveState(code, room.version, state) };
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 409)) throw e;
        ({ room, players } = await loadRoom(code)); // the other join started it
      }
    }

    await broadcast(room, players);
    return Response.json(roomView(room, players, who.id));
  });
}
