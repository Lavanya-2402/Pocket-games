import { getEngine } from "@/games";
import { start, wrap } from "@/games/runner";
import { profileSchema, resolvePlayer } from "@/lib/accounts";
import {
  authPlayer, broadcast, codeSchema, db, handle, HttpError, identity, loadRoom,
  parseBody, playerRow, roomView, saveState, seatedIds,
} from "@/lib/server";

/** Take a free seat (or spectate if full). Starts the game once both seats are filled. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const body = await parseBody(req, profileSchema);

    let { room, players } = await loadRoom(code);
    if (!(await authPlayer(players, who))) {
      const profile = await resolvePlayer(who, body);
      const taken = new Set(players.map((p) => p.seat));
      let seat: number | null = !taken.has(0) ? 0 : !taken.has(1) ? 1 : null;
      let { error } = await db().from("room_players").insert(await playerRow(code, who, profile, seat));
      if (error?.code === "23505" && seat !== null) {
        // Someone grabbed the seat at the same instant — spectate instead.
        seat = null;
        ({ error } = await db().from("room_players").insert(await playerRow(code, who, profile, seat)));
      }
      if (error) throw error;
      ({ room, players } = await loadRoom(code));
    }

    const seated = seatedIds(players);
    if (!room.state && seated) {
      const engine = getEngine(room.game)!;
      const fresh = engine.init(seated, Math.floor(Math.random() * 2 ** 31));
      const state = wrap(fresh, start(engine, fresh, Date.now()));
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
