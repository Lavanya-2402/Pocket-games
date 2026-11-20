import { getEngine } from "@/games";
import { begin, unwrap } from "@/games/runner";
import { areFriends, profileSchema, resolvePlayer } from "@/lib/accounts";
import {
  authPlayer, broadcast, codeSchema, commit, db, handle, HttpError, identity, loadRoom,
  parseBody, playerRow, roomView,
} from "@/lib/server";

/** Take a free seat (or spectate if full). Starts the game once both seats are filled. */
export function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/join">) {
  return handle(async () => {
    const code = (await ctx.params).code.toUpperCase();
    if (!codeSchema.safeParse(code).success) throw new HttpError(404, "Room not found");
    const who = identity(req);
    const body = await parseBody(req, profileSchema);

    let { room, players } = await loadRoom(code);
    let joined = false;
    if (!(await authPlayer(players, who))) {
      const profile = await resolvePlayer(who, body);
      const taken = new Set(players.map((p) => p.seat));
      let seat: number | null = !taken.has(0) ? 0 : !taken.has(1) ? 1 : null;

      // Private rooms: friends of the creator only, and no spectators.
      if (unwrap(room.state).meta.options.private) {
        const owner = players.find((p) => p.seat === 0)?.player_id;
        if (seat === null) throw new HttpError(403, "This room is private");
        if (owner && !(profile.account && (await areFriends(owner, who.id)))) {
          throw new HttpError(403, "This room is private — only the host's friends can join");
        }
      }

      let { error } = await db().from("room_players").insert(await playerRow(code, who, profile, seat));
      if (error?.code === "23505" && seat !== null) {
        // Someone grabbed the seat at the same instant — spectate instead.
        seat = null;
        ({ error } = await db().from("room_players").insert(await playerRow(code, who, profile, seat)));
      }
      if (error) throw error;
      ({ room, players } = await loadRoom(code));
      joined = true;
    }

    const { state, meta } = unwrap(room.state);
    const a = players.find((p) => p.seat === 0);
    const b = players.find((p) => p.seat === 1);
    if (!state && a && b) {
      const engine = getEngine(room.game)!;
      const started = begin(engine, [a.player_id, b.player_id], Math.floor(Math.random() * 2 ** 31), meta, Date.now());
      try {
        room = await commit(room, players, started, meta); // also notifies the room
        joined = false;
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 409)) throw e;
        ({ room, players } = await loadRoom(code)); // the other join started it
      }
    }

    if (joined) await broadcast(room, players);
    return Response.json(roomView(room, players, who.id));
  });
}
