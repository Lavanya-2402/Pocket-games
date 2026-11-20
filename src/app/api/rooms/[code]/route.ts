import { unwrap } from "@/games/runner";
import { authPlayer, codeSchema, handle, HttpError, identity, loadRoom, roomView } from "@/lib/server";

/** The room as this caller is allowed to see it. */
export function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const { room, players } = await loadRoom(code);
    const me = await authPlayer(players, who);
    if (!me && unwrap(room.state).meta.options.private) throw new HttpError(403, "This room is private");
    return Response.json(roomView(room, players, me?.player_id ?? null));
  });
}
