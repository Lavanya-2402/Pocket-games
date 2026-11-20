import { z } from "zod";
import { getEngine } from "@/games";
import { outcome, playerMove, unwrap } from "@/games/runner";
import {
  authPlayer, codeSchema, commit, db, handle, HttpError, identity, loadRoom,
  parseBody, roomView,
} from "@/lib/server";

const bodySchema = z.object({ move: z.unknown(), version: z.number().int() });

/** Server-authoritative move: validate → apply → save (optimistic lock) → log → broadcast. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/move">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const body = await parseBody(req, bodySchema);

    // Simultaneous games (both players act in the same round) may race; retry a few times.
    for (let attempt = 0; ; attempt++) {
      const { room, players } = await loadRoom(code);
      const me = await authPlayer(players, who);
      if (!me || me.seat === null) throw new HttpError(403, "Spectators can't move");
      const { state, meta } = unwrap(room.state);
      if (!state) throw new HttpError(409, "Waiting for an opponent");

      const engine = getEngine(room.game)!;
      if (outcome(engine, state, meta) !== null) throw new HttpError(422, "Game is over");
      const simultaneous = engine.turn(state) === null;
      // Turn-based: the move must be made against the board the player actually saw.
      // Simultaneous: the other player's bid may land first; the engine's own checks suffice.
      if (!simultaneous && body.version !== room.version) throw new HttpError(409, "Board changed — refreshing");

      const parsed = engine.moveSchema.safeParse(body.move);
      if (!parsed.success) throw new HttpError(400, "Invalid move");
      const problem = engine.validate(state, parsed.data, who.id);
      if (problem) throw new HttpError(422, problem);

      const r = playerMove(engine, state, meta, parsed.data, who.id, Date.now());
      let next;
      try {
        next = await commit(room, players, r, meta); // the computer replies here too
      } catch (e) {
        if (simultaneous && attempt < 3 && e instanceof HttpError && e.status === 409) continue;
        throw e;
      }
      await db().from("moves")
        .insert({ room_code: code, player_id: who.id, move: parsed.data, version: next.version })
        .then(({ error }) => error && console.error("move log failed", error));
      return Response.json(roomView(next, players, who.id));
    }
  });
}
