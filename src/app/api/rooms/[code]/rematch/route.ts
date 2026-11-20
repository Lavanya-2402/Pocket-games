import { getEngine } from "@/games";
import { begin, outcome, unwrap } from "@/games/runner";
import {
  authPlayer, codeSchema, commit, handle, HttpError, identity, loadRoom, roomView,
} from "@/lib/server";

/**
 * Next game in the same room, with the other player going first. The match score
 * carries over; once a best-of match is decided, this starts a new match.
 */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/rematch">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);

    const { room, players } = await loadRoom(code);
    const me = await authPlayer(players, who);
    if (!me || me.seat === null) throw new HttpError(403, "Only players can start a rematch");
    const engine = getEngine(room.game)!;
    const { state: prev, meta } = unwrap(room.state);
    if (!prev || outcome(engine, prev, meta) === null) throw new HttpError(409, "Game still in progress");

    const [p0, p1] = (prev as { players: [string, string] }).players;
    const started = begin(engine, [p1, p0], Math.floor(Math.random() * 2 ** 31), meta, Date.now());
    const next = await commit(room, players, started, started.meta);
    return Response.json(roomView(next, players, who.id));
  });
}
