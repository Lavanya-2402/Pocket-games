import { describe, expect, it } from "vitest";
import { duel as g, MAX_HP, MAX_ROUNDS, type Action, type DuelState } from "./duel";

const A = "alice";
const B = "bob";

function round(s: DuelState, a: Action, b: Action) {
  expect(g.validate(s, { action: a }, A)).toBeNull();
  s = g.apply(s, { action: a }, A);
  expect(g.validate(s, { action: b }, B)).toBeNull();
  return g.apply(s, { action: b }, B);
}

describe("simultaneous duel", () => {
  it("attack hits, defend blocks, charge builds energy", () => {
    let s = round(g.init([A, B], 0), "attack", "charge");
    expect(s.hp).toEqual([MAX_HP, MAX_HP - 1]);
    expect(s.energy).toEqual([0, 2]);
    s = round(s, "charge", "attack");
    expect(s.hp).toEqual([MAX_HP - 1, MAX_HP - 1]);
    s = round(s, "defend", "attack");
    expect(s.hp).toEqual([MAX_HP - 1, MAX_HP - 1]);
    expect(s.last).toEqual({ actions: ["defend", "attack"], damage: [0, 0] });
  });

  it("blast costs 3 and ignores defend", () => {
    let s = g.init([A, B], 0);
    s = round(s, "charge", "defend");
    s = round(s, "charge", "defend");
    expect(s.energy[0]).toBe(3);
    expect(g.validate(s, { action: "defend" }, B)).toMatch(/in a row/);
    s = round(s, "blast", "charge");
    expect(s.hp[1]).toBe(MAX_HP - 2);
    expect(s.energy[0]).toBe(0);
  });

  it("rejects moves without enough energy and double picks", () => {
    const s = g.init([A, B], 0);
    expect(g.validate(s, { action: "blast" }, A)).toMatch(/needs 3 energy/);
    const s2 = g.apply(s, { action: "charge" }, A);
    expect(g.validate(s2, { action: "attack" }, A)).toMatch(/already picked/);
    expect(g.validate(s2, { action: "charge" }, "eve")).toMatch(/not a player/);
  });

  it("hides the opponent's pick until both are in", () => {
    const s = g.apply(g.init([A, B], 0), { action: "attack" }, A);
    expect((g.viewFor(s, B) as { pending: unknown[] }).pending).toEqual(["hidden", null]);
    expect((g.viewFor(s, A) as { pending: unknown[] }).pending).toEqual(["attack", null]);
    expect(JSON.stringify(g.viewFor(s, B))).not.toContain("attack");
  });

  it("ends at 0 HP, with a draw if both fall together", () => {
    let s = g.init([A, B], 0);
    // Both trade attacks while recharging; Alice wins by having one extra hit.
    for (let i = 0; i < 4; i++) {
      s = round(s, "attack", "charge");
      s = round(s, "charge", "defend");
    }
    expect(s.hp[1]).toBe(1);
    s = round(s, "attack", "charge");
    expect(g.winner(s)).toBe(A);

    let d = g.init([A, B], 0);
    d.hp = [1, 1];
    d = round(d, "attack", "attack");
    expect(g.winner(d)).toBe("draw");
  });

  it("decides on HP after the last round", () => {
    let s = g.init([A, B], 0);
    s = round(s, "attack", "charge"); // Bob -1
    while (!s.winner) s = round(s, "charge", "charge");
    expect(s.round).toBe(MAX_ROUNDS + 1);
    expect(g.winner(s)).toBe(A);
  });
});
