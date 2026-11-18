import { describe, expect, it } from "vitest";
import { bidTacToe as g, START_COINS, type BidTacToeState } from "./bidtactoe";

const A = "alice";
const B = "bob";

/** seed 0 → Alice (seat 0) holds the tie-breaker. */
function round(s: BidTacToeState, a: [number, number], b: [number, number]) {
  const ma = { bid: a[0], cell: a[1] };
  const mb = { bid: b[0], cell: b[1] };
  expect(g.validate(s, ma, A)).toBeNull();
  s = g.apply(s, ma, A);
  expect(g.validate(s, mb, B)).toBeNull();
  return g.apply(s, mb, B);
}

describe("bid-tac-toe", () => {
  it("higher bid places its mark and pays the opponent", () => {
    const s = round(g.init([A, B], 0), [30, 4], [20, 0]);
    expect(s.board[4]).toBe(0);
    expect(s.board[0]).toBeNull();
    expect(s.coins).toEqual([START_COINS - 30, START_COINS + 30]);
    expect(s.last).toMatchObject({ won: 0, tie: false });
    expect(s.round).toBe(2);
  });

  it("ties go to the tie-breaker holder, who then passes it", () => {
    let s = g.init([A, B], 0);
    expect(s.tieHolder).toBe(0);
    s = round(s, [10, 0], [10, 8]);
    expect(s.board[0]).toBe(0);
    expect(s.tieHolder).toBe(1);
    s = round(s, [5, 1], [5, 2]);
    expect(s.board[2]).toBe(1);
    expect(s.tieHolder).toBe(0);
  });

  it("hides the opponent's pending bid but shows that they bid", () => {
    const s = g.apply(g.init([A, B], 0), { bid: 42, cell: 3 }, A);
    const forBob = g.viewFor(s, B) as { pending: unknown[] };
    const forAlice = g.viewFor(s, A) as { pending: unknown[] };
    const forSpectator = g.viewFor(s, null) as { pending: unknown[] };
    expect(forBob.pending).toEqual(["hidden", null]);
    expect(forAlice.pending).toEqual([{ bid: 42, cell: 3 }, null]);
    expect(forSpectator.pending).toEqual(["hidden", null]);
    expect(JSON.stringify(forBob)).not.toContain("42");
  });

  it("rejects double bids, overspending and taken cells", () => {
    let s = round(g.init([A, B], 0), [100, 4], [0, 0]);
    expect(s.coins).toEqual([0, 200]);
    expect(g.validate(s, { bid: 1, cell: 0 }, A)).toMatch(/only have 0/);
    expect(g.validate(s, { bid: 0, cell: 4 }, A)).toBe("Cell already taken");
    s = g.apply(s, { bid: 0, cell: 0 }, A);
    expect(g.validate(s, { bid: 0, cell: 1 }, A)).toBe("You already bid this round");
    expect(g.validate(s, { bid: 0, cell: 1 }, "eve")).toMatch(/not a player/);
  });

  it("detects a win", () => {
    let s = g.init([A, B], 0);
    s = round(s, [10, 0], [0, 4]);
    s = round(s, [10, 1], [0, 4]);
    s = round(s, [10, 2], [0, 4]);
    expect(g.winner(s)).toBe(A);
    expect(s.line).toEqual([0, 1, 2]);
    expect(g.validate(s, { bid: 0, cell: 5 }, B)).toBe("Game is over");
  });

  it("is simultaneous", () => {
    expect(g.turn(g.init([A, B], 0))).toBeNull();
  });
});
