import { describe, expect, it } from "vitest";
import { connect4 } from "./connect4";
import {
  begin, BOT_ID, botTurns, DEFAULT_OPTIONS, newRoomMeta, outcome, playerMove, start, timeout, waitingOn,
  type Meta,
} from "./runner";
import { ticTacToe, type TicTacToeState } from "./tictactoe";

const A = "alice";
const B = "bob";
const rng = () => 0;

/** Play a Tic Tac Toe game where `winner` takes the top row. */
function finish(winner: string, meta: Meta) {
  const loser = winner === A ? B : A;
  let s: unknown = ticTacToe.init([winner, loser], 0);
  let m = meta;
  for (const [p, cell] of [[winner, 0], [loser, 3], [winner, 1], [loser, 4], [winner, 2]] as const) {
    ({ state: s, meta: m } = playerMove(ticTacToe, s, m, { cell }, p, 0));
  }
  return m;
}
const fresh = () => ticTacToe.init([A, B], 0);

describe("match score", () => {
  it("counts wins, streaks and a best-of-3 match", () => {
    let m = start(ticTacToe, fresh(), 0, newRoomMeta({ ...DEFAULT_OPTIONS, bestOf: 3 }));
    m = finish(A, m);
    expect(m.series).toMatchObject({ wins: { [A]: 1 }, games: 1, streak: { id: A, n: 1 }, done: false });
    expect(m.resultId).toBeTruthy();
    m = finish(B, start(ticTacToe, fresh(), 0, m));
    expect(m.series).toMatchObject({ wins: { [A]: 1, [B]: 1 }, streak: { id: B, n: 1 }, done: false });
    m = finish(B, start(ticTacToe, fresh(), 0, m));
    expect(m.series).toMatchObject({ wins: { [A]: 1, [B]: 2 }, games: 3, streak: { id: B, n: 2 }, done: true });
    // A new match starts from zero but keeps the room's options.
    const next = start(ticTacToe, fresh(), 0, m);
    expect(next.series.games).toBe(0);
    expect(next.options.bestOf).toBe(3);
    expect(next.resultId).toBeNull();
  });

  it("free play keeps a running score and never ends the match", () => {
    let m = start(ticTacToe, fresh(), 0);
    for (let i = 0; i < 4; i++) m = finish(A, start(ticTacToe, fresh(), 0, m));
    expect(m.series).toMatchObject({ wins: { [A]: 4 }, streak: { id: A, n: 4 }, done: false });
  });

  it("logs moves (including automatic ones) for replays", () => {
    const b = begin(ticTacToe, [A, B], 7, null, 0);
    expect(b.meta).toMatchObject({ seed: 7, order: [A, B], log: [] });
    const r = playerMove(ticTacToe, b.state, b.meta, { cell: 4 }, A, 0);
    expect(r.meta.log).toEqual([[0, { cell: 4 }]]);
    const t = timeout(ticTacToe, r.state, r.meta, r.meta.deadline!, rng)!;
    expect(t.meta.log).toHaveLength(2);
    expect(t.meta.log[1][0]).toBe(1);
  });

  it("a forfeit counts as a win for the other player", () => {
    let s: unknown = fresh();
    let m = start(ticTacToe, s, 0);
    for (let i = 0; i < 4 && !m.forfeit; i++) {
      const t = timeout(ticTacToe, s, m, m.deadline!, rng)!;
      ({ state: s, meta: m } = t);
      if (t.forfeited) break;
      const open = (s as TicTacToeState).board.lastIndexOf(null);
      ({ state: s, meta: m } = playerMove(ticTacToe, s, m, { cell: open }, B, 0));
    }
    expect(m.forfeit).toBe(A);
    expect(m.series.wins[B]).toBe(1);
    expect(m.deadline).toBeNull();
  });
});

describe("computer opponent", () => {
  it("replies straight away and never loses Tic Tac Toe on hard", () => {
    for (let game = 0; game < 30; game++) {
      const players: [string, string] = game % 2 === 0 ? [A, BOT_ID] : [BOT_ID, A];
      let { state, meta } = begin(ticTacToe, players, game, newRoomMeta({ ...DEFAULT_OPTIONS, bot: "hard" }), 0);
      ({ state, meta } = botTurns(ticTacToe, state, meta, 0, Math.random));
      while (outcome(ticTacToe, state, meta) === null) {
        expect(waitingOn(ticTacToe, state)).toEqual([A]);
        const open = (state as TicTacToeState).board.flatMap((c, i) => (c === null ? [i] : []));
        const cell = open[Math.floor(Math.random() * open.length)];
        ({ state, meta } = playerMove(ticTacToe, state, meta, { cell }, A, 0));
        ({ state, meta } = botTurns(ticTacToe, state, meta, 0, Math.random));
      }
      expect(outcome(ticTacToe, state, meta)).not.toBe(A);
    }
  });

  it("takes a winning Connect Four move and blocks an immediate loss", () => {
    let s = connect4.init([BOT_ID, A], 0);
    // The bot has three in column 0 and it is the bot's turn.
    for (const [p, col] of [[BOT_ID, 0], [A, 6], [BOT_ID, 0], [A, 6], [BOT_ID, 0], [A, 5]] as const) {
      s = connect4.apply(s, { col }, p);
    }
    expect(connect4.botMove!(s, BOT_ID, Math.random, "hard")).toEqual({ col: 0 });
    // The human has three along the bottom row (columns 0-2): the only block is column 3.
    s = connect4.init([BOT_ID, A], 0);
    for (const [p, col] of [[BOT_ID, 6], [A, 0], [BOT_ID, 6], [A, 1], [BOT_ID, 5], [A, 2]] as const) {
      s = connect4.apply(s, { col }, p);
    }
    expect(connect4.botMove!(s, BOT_ID, Math.random, "hard")).toEqual({ col: 3 });
  });

  it("thinks fast enough for a serverless request", () => {
    const s = connect4.init([BOT_ID, A], 0);
    const t = performance.now();
    connect4.botMove!(s, BOT_ID, Math.random, "hard");
    expect(performance.now() - t).toBeLessThan(1500);
  });

  it("has no clock, and the human's clock starts after it moves", () => {
    let { state, meta } = begin(ticTacToe, [BOT_ID, A], 1, newRoomMeta({ ...DEFAULT_OPTIONS, bot: "easy" }), 1000);
    expect(meta.deadline).toBeNull();
    ({ state, meta } = botTurns(ticTacToe, state, meta, 1000, Math.random));
    expect(meta.deadline).toBe(1000 + 20_000);
    expect(meta.log).toHaveLength(1);
  });
});
