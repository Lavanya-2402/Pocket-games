import { getEngine } from "@/games";
import { begin, unwrap } from "@/games/runner";
import {
  authPlayer, codeSchema, commit, handle, HttpError, identity, loadRoom, roomView, seatedIds,
} from "@/lib/server";

/**
 * The host starts the game before every seat is filled (rooms for three or more).
 * Whoever has joined so far plays; the empty seats are closed.
 */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/start">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);

    const { room, players } = await loadRoom(code);
    const me = await authPlayer(players, who);
    if (!me || me.seat !== 0) throw new HttpError(403, "Only the host can start the game");
    const { state, meta } = unwrap(room.state);
    if (state) throw new HttpError(409, "The game has already started");

    const engine = getEngine(room.game)!;
    const seated = seatedIds(players);
    const min = engine.minPlayers ?? 2;
    if (seated.length < min) throw new HttpError(409, `Need at least ${min} players to start`);

    const closed = { ...meta, options: { ...meta.options, seats: seated.length } };
    const started = begin(engine, seated, Math.floor(Math.random() * 2 ** 31), closed, Date.now());
    return Response.json(roomView(await commit(room, players, started, closed), players, who.id));
  });
}
