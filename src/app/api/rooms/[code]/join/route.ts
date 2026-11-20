import { getEngine } from "@/games";
import { begin, unwrap } from "@/games/runner";
import { areFriends, profileSchema, resolvePlayer } from "@/lib/accounts";
import {
  authPlayer, broadcast, codeSchema, commit, db, handle, HttpError, identity, loadRoom,
  parseBody, playerRow, roomView, seatedIds,
} from "@/lib/server";

/**
 * Take a free seat (or spectate if the room is full or already playing).
 * The game starts by itself once every seat is filled; with three or more seats the
 * host can also start early (see ../start).
 */
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
      const { state: playing, meta } = unwrap(room.state);
      const taken = new Set(players.map((p) => p.seat));
      const free = Array.from({ length: meta.options.seats }, (_, i) => i).find((i) => !taken.has(i));
      let seat: number | null = playing || free === undefined ? null : free;

      // Private rooms: friends of the creator only, and no spectators.
      if (meta.options.private) {
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
    const seated = seatedIds(players);
    if (!state && seated.length >= meta.options.seats) {
      const started = begin(getEngine(room.game)!, seated, Math.floor(Math.random() * 2 ** 31), meta, Date.now());
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
