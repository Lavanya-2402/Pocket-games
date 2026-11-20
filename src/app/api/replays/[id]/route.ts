import { z } from "zod";
import { getEngine } from "@/games";
import { authPlayer, db, handle, HttpError, identity, isMissing, loadRoom, validSession } from "@/lib/server";

interface Row {
  id: string; room_code: string; game: string; p0: string; p1: string; names: string[];
  winner: string | null; forfeit: boolean; finished_at: string;
  replay: { seed: number; order: string[]; rules: Record<string, boolean>; log: [number, unknown][] } | null;
}

/**
 * Everything needed to replay one finished game. Only people who were in the room
 * may fetch it, because a replay shows what was hidden during play.
 */
export function GET(req: Request, ctx: RouteContext<"/api/replays/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Replay not found");
    const who = identity(req);

    const { data, error } = await db().from("results")
      .select("id, room_code, game, p0, p1, names, winner, forfeit, finished_at, replay")
      .eq("id", id).maybeSingle<Row>();
    if (error && !isMissing(error)) throw error;
    if (!data?.replay || !getEngine(data.game)) throw new HttpError(404, "Replay not found");

    // Were they there? Check the room's player list; if the room is gone, fall back to
    // "is one of the two players, with a valid login".
    let allowed = false;
    try {
      const { players } = await loadRoom(data.room_code);
      allowed = (await authPlayer(players, who)) !== null;
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
      allowed = [data.p0, data.p1].includes(who.id) && (await validSession(who));
    }
    if (!allowed) throw new HttpError(403, "Only people who were in that room can watch its replay");

    return Response.json({
      id: data.id,
      game: data.game,
      gameName: getEngine(data.game)!.name,
      names: data.names,
      winner: data.winner,
      forfeit: data.forfeit,
      at: Date.parse(data.finished_at),
      ...data.replay,
    });
  });
}
