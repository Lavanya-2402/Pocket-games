import { getEngine } from "@/games";
import { timeout, unwrap, wrap } from "@/games/runner";
import {
  authPlayer, broadcast, codeSchema, db, handle, HttpError, identity, loadRoom, roomView, saveState,
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
    const { state, meta } = unwrap(room.state);
    if (!state) return Response.json(roomView(room, players, me?.player_id ?? null));

    const engine = getEngine(room.game)!;
    const r = timeout(engine, state, meta, Date.now(), Math.random);
    if (!r) return Response.json(roomView(room, players, me?.player_id ?? null));

    const stored = wrap(r.state, r.meta);
    let version: number;
    try {
      version = await saveState(code, room.version, stored);
    } catch (e) {
      // Another phone enforced it (or someone moved) first — just return the latest.
      if (e instanceof HttpError && e.status === 409) {
        const fresh = await loadRoom(code);
        return Response.json(roomView(fresh.room, fresh.players, me?.player_id ?? null));
      }
      throw e;
    }
    const next = { ...room, state: stored, version };
    await Promise.all([
      db().from("moves")
        .insert({ room_code: code, player_id: who.id, move: { timeout: true, forfeit: r.forfeited }, version })
        .then(({ error }) => error && console.error("move log failed", error)),
      broadcast(next, players),
    ]);
    return Response.json(roomView(next, players, me?.player_id ?? null));
  });
}
