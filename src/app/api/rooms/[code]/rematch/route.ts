import { getEngine } from "@/games";
import { outcome, start, unwrap, wrap } from "@/games/runner";
import {
  authPlayer, broadcast, codeSchema, handle, HttpError, identity, loadRoom, roomView, saveState,
} from "@/lib/server";

/** New game in the same room, with the other player going first. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/rematch">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);

    const { room, players } = await loadRoom(code);
    const me = authPlayer(players, who);
    if (!me || me.seat === null) throw new HttpError(403, "Only players can start a rematch");
    const engine = getEngine(room.game)!;
    const { state: prev, meta } = unwrap(room.state);
    if (!prev || outcome(engine, prev, meta) === null) throw new HttpError(409, "Game still in progress");

    const [p0, p1] = (prev as { players: [string, string] }).players;
    const fresh = engine.init([p1, p0], Math.floor(Math.random() * 2 ** 31));
    const state = wrap(fresh, start(engine, fresh, Date.now()));
    const version = await saveState(code, room.version, state);
    const next = { ...room, state, version };
    await broadcast(next, players);
    return Response.json(roomView(next, players, who.id));
  });
}
