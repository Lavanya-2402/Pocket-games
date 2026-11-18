import { getEngine } from "@/games";
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
    if (!room.state || engine.winner(room.state) === null) throw new HttpError(409, "Game still in progress");

    const prev = (room.state as { players: [string, string] }).players;
    const state = engine.init([prev[1], prev[0]], Math.floor(Math.random() * 2 ** 31));
    const version = await saveState(code, room.version, state);
    const next = { ...room, state, version };
    await broadcast(next, players);
    return Response.json(roomView(next, players, who.id));
  });
}
