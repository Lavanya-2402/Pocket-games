import { describe, expect, it } from "vitest";
import { bidTacToe } from "./bidtactoe";
import { duel } from "./duel";
import { missLimit, outcome, playerMove, start, timeout, unwrap, waitingOn, wrap } from "./runner";
import { ticTacToe, type TicTacToeState } from "./tictactoe";

const A = "alice";
const B = "bob";
const rng = () => 0;

describe("runner: turn clock", () => {
  it("starts a clock for the player to move", () => {
    const s = ticTacToe.init([A, B], 0);
    const m = start(ticTacToe, s, 1000);
    expect(m.deadline).toBe(1000 + 20_000);
    expect(waitingOn(ticTacToe, s)).toEqual([A]);
  });

  it("restarts the clock after each move", () => {
    const s = ticTacToe.init([A, B], 0);
    const m = start(ticTacToe, s, 0);
    const r = playerMove(ticTacToe, s, m, { cell: 4 }, A, 5000);
    expect(r.meta.deadline).toBe(25_000);
  });

  it("does nothing before the deadline", () => {
    const s = ticTacToe.init([A, B], 0);
    const m = start(ticTacToe, s, 0);
    expect(timeout(ticTacToe, s, m, 19_999, rng)).toBeNull();
  });

  it("plays an automatic move when time runs out", () => {
    const s = ticTacToe.init([A, B], 0);
    const m = start(ticTacToe, s, 0);
    const r = timeout(ticTacToe, s, m, 20_000, rng)!;
    expect((r.state as TicTacToeState).board[0]).toBe("X");
    expect(r.meta.misses[A]).toBe(1);
    expect(r.meta.deadline).toBe(40_000);
    expect(r.forfeited).toBeNull();
  });

  it("forfeits after missing turns worth the grace period", () => {
    expect(missLimit(20)).toBe(3);
    expect(missLimit(30)).toBe(2);
    let s: unknown = ticTacToe.init([A, B], 0);
    let m = start(ticTacToe, s, 0);
    let now = 0;
    // Bob keeps playing; Alice never does.
    for (let i = 0; i < 2; i++) {
      now = m.deadline!;
      ({ state: s, meta: m } = timeout(ticTacToe, s, m, now, rng)!);
      const open = (s as TicTacToeState).board.lastIndexOf(null);
      ({ state: s, meta: m } = playerMove(ticTacToe, s, m, { cell: open }, B, now));
    }
    const r = timeout(ticTacToe, s, m, m.deadline!, rng)!;
    expect(r.forfeited).toBe(A);
    expect(outcome(ticTacToe, r.state, r.meta)).toBe(B);
    expect(r.meta.deadline).toBeNull();
  });

  it("moving resets your missed-turn count", () => {
    const s = ticTacToe.init([A, B], 0);
    const t = timeout(ticTacToe, s, start(ticTacToe, s, 0), 20_000, rng)!; // A missed, auto-moved
    const b = playerMove(ticTacToe, t.state, t.meta, { cell: 8 }, B, 21_000);
    const a = playerMove(ticTacToe, b.state, b.meta, { cell: 4 }, A, 22_000);
    expect(a.meta.misses[A]).toBe(0);
  });

  it("keeps a simultaneous round's clock while players lock in", () => {
    const s = duel.init([A, B], 0);
    const m = start(duel, s, 0);
    const r = playerMove(duel, s, m, { action: "charge" }, A, 5000);
    expect(r.meta.deadline).toBe(m.deadline);
    expect(waitingOn(duel, r.state)).toEqual([B]);
    const r2 = playerMove(duel, r.state, r.meta, { action: "charge" }, B, 6000);
    expect(r2.meta.deadline).toBe(6000 + 15_000); // new round, new clock
  });

  it("times out only the player who hasn't locked in", () => {
    const s = bidTacToe.init([A, B], 0);
    const m = start(bidTacToe, s, 0);
    const r = playerMove(bidTacToe, s, m, { bid: 10, cell: 4 }, A, 1000);
    const t = timeout(bidTacToe, r.state, r.meta, m.deadline!, rng)!;
    expect(t.meta.misses[B]).toBe(1);
    expect(t.meta.misses[A]).toBe(0);
    expect((t.state as { board: unknown[] }).board[4]).toBe(0); // Alice's 10 beat Bob's auto 0
  });

  it("stores and loads state with meta, and loads old bare states", () => {
    const s = ticTacToe.init([A, B], 0);
    const m = start(ticTacToe, s, 0);
    expect(unwrap(wrap(s, m))).toEqual({ state: s, meta: m });
    expect(unwrap(s).meta).toEqual({ deadline: null, misses: {}, forfeit: null });
  });

  it("stops the clock when the game ends", () => {
    let s: unknown = ticTacToe.init([A, B], 0);
    let m = start(ticTacToe, s, 0);
    for (const [p, cell] of [[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]] as const) {
      ({ state: s, meta: m } = playerMove(ticTacToe, s, m, { cell }, p, 0));
    }
    expect(m.deadline).toBeNull();
  });
});
