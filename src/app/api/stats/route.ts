import { getEngine } from "@/games";
import { ACCOUNT_COLS, publicAccount, requireAccount, type Account } from "@/lib/accounts";
import { db, handle, HttpError, isMissing } from "@/lib/server";

interface Row {
  id: string; game: string; p0: string; p1: string; players: string[] | null; names: string[];
  winner: string | null; forfeit: boolean; vs_bot: boolean; finished_at: string;
}
const COLS = "id, game, p0, p1, players, names, winner, forfeit, vs_bot, finished_at";
/** Everyone who played, in turn order. */
const seats = (row: Row) => (row.players?.length ? row.players : [row.p0, row.p1]);

const tally = () => ({ wins: 0, losses: 0, draws: 0 });
type Tally = ReturnType<typeof tally>;
function count(t: Tally, row: Row, id: string) {
  if (row.winner === null) t.draws++;
  else if (row.winner === id) t.wins++;
  else t.losses++;
}

/**
 * Your record, a leaderboard of you and your friends, and your recent games.
 * Games against the computer are listed but never counted.
 */
export function GET(req: Request) {
  return handle(async () => {
    const me = await requireAccount(req);

    const { data: links, error: fErr } = await db().from("friends").select("account_id, friend_id")
      .or(`account_id.eq.${me.id},friend_id.eq.${me.id}`).eq("status", "accepted")
      .returns<{ account_id: string; friend_id: string }[]>();
    if (fErr) throw fErr;
    const friendIds = links.map((l) => (l.account_id === me.id ? l.friend_id : l.account_id));
    const ids = [me.id, ...friendIds];

    const [ranked, mine, people] = await Promise.all([
      db().from("results").select(COLS).overlaps("players", ids).eq("vs_bot", false)
        .order("finished_at", { ascending: false }).limit(2000).returns<Row[]>(),
      db().from("results").select(COLS).contains("players", [me.id])
        .order("finished_at", { ascending: false }).limit(15).returns<Row[]>(),
      friendIds.length
        ? db().from("accounts").select(ACCOUNT_COLS).in("id", friendIds).returns<Account[]>()
        : Promise.resolve({ data: [] as Account[], error: null }),
    ]);
    if (ranked.error) {
      if (isMissing(ranked.error)) {
        throw new HttpError(503, "Records aren't set up yet — run supabase/migrations/003_results_and_push.sql in Supabase");
      }
      throw ranked.error;
    }
    if (mine.error) throw mine.error;
    if (people.error) throw people.error;

    // Overall record per person, and head-to-head against me.
    const overall = new Map(ids.map((id) => [id, tally()]));
    const versus = new Map(friendIds.map((id) => [id, tally()]));
    const byGame = new Map<string, Tally>();
    for (const row of ranked.data) {
      const played = seats(row);
      for (const id of played) {
        const t = overall.get(id);
        if (t) count(t, row, id);
      }
      if (played.includes(me.id)) {
        // Head to head only counts when one of the two of us won (or nobody did).
        for (const other of played) {
          const v = versus.get(other);
          if (v && (row.winner === null || row.winner === me.id || row.winner === other)) count(v, row, me.id);
        }
        if (!byGame.has(row.game)) byGame.set(row.game, tally());
        count(byGame.get(row.game)!, row, me.id);
      }
    }

    const board = [
      { person: publicAccount(me), you: true, ...overall.get(me.id)!, vsYou: null as Tally | null },
      ...people.data.map((a) => ({ person: publicAccount(a), you: false, ...overall.get(a.id)!, vsYou: versus.get(a.id)! })),
    ].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.person.name.localeCompare(b.person.name));

    return Response.json({
      me: overall.get(me.id),
      board,
      byGame: [...byGame].map(([game, t]) => ({ game, name: getEngine(game)?.name ?? game, ...t }))
        .sort((a, b) => b.wins + b.losses + b.draws - (a.wins + a.losses + a.draws)),
      recent: mine.data.map((row) => {
        const played = seats(row);
        const others = row.names.filter((_, i) => played[i] !== me.id);
        return {
          id: row.id,
          game: getEngine(row.game)?.name ?? row.game,
          opponent: row.vs_bot ? "Computer" : others.join(", ") || "Player",
          result: row.winner === null ? "draw" : row.winner === me.id ? "win" : "loss",
          forfeit: row.forfeit,
          vsBot: row.vs_bot,
          at: Date.parse(row.finished_at),
        };
      }),
    });
  });
}
