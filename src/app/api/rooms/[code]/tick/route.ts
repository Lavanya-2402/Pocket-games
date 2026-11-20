import { getEngine } from "@/games";
import { timeout, unwrap } from "@/games/runner";
import {
  authPlayer, codeSchema, commit, handle, HttpError, identity, loadRoom, roomView,
} from "@/lib/server";

/**
 * Enforce the turn clock. Serverless has no background jobs, so any phone in the room
 * calls this once the deadline passes; the server checks the time itself, so calling
 * early (or twice) does nothing.
 */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/tick">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);

    const { room, players } = await loadRoom(code);
    const me = await authPlayer(players, who);
    const viewer = me?.player_id ?? null;
    const { state, meta } = unwrap(room.state);
    if (!state) return Response.json(roomView(room, players, viewer));

    const r = timeout(getEngine(room.game)!, state, meta, Date.now(), Math.random);
    if (!r) return Response.json(roomView(room, players, viewer));

    try {
      return Response.json(roomView(await commit(room, players, r, meta), players, viewer));
    } catch (e) {
      // Another phone enforced it (or someone moved) first — just return the latest.
      if (e instanceof HttpError && e.status === 409) {
        const fresh = await loadRoom(code);
        return Response.json(roomView(fresh.room, fresh.players, viewer));
      }
      throw e;
    }
  });
}
