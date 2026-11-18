import { describe, expect, it } from "vitest";
import { fleetProblem, randomFleet, seaBattle as g, type SeaBattleState, type SeaBattleView, type Ship } from "./seabattle";
import { playerMove, start, timeout } from "./runner";

const A = "alice";
const B = "bob";

// Rows 0..3 horizontal from column 0: lengths 4,3,3,2.
const FLEET_A: Ship[] = [
  { r: 0, c: 0, len: 4, dir: "h" },
  { r: 1, c: 0, len: 3, dir: "h" },
  { r: 2, c: 0, len: 3, dir: "h" },
  { r: 3, c: 0, len: 2, dir: "h" },
];
const FLEET_B: Ship[] = [
  { r: 0, c: 7, len: 4, dir: "v" },
  { r: 0, c: 6, len: 3, dir: "v" },
  { r: 0, c: 5, len: 3, dir: "v" },
  { r: 0, c: 4, len: 2, dir: "v" },
];

function placed(): SeaBattleState {
  let s = g.init([A, B], 0);
  s = g.apply(s, { type: "place", ships: FLEET_A }, A);
  return g.apply(s, { type: "place", ships: FLEET_B }, B);
}

describe("sea battle", () => {
  it("validates fleets", () => {
    expect(fleetProblem(FLEET_A)).toBeNull();
    expect(fleetProblem([...FLEET_A.slice(0, 3), { r: 3, c: 0, len: 3, dir: "h" }])).toBe("Wrong set of ships");
    expect(fleetProblem([...FLEET_A.slice(0, 3), { r: 0, c: 0, len: 2, dir: "v" }])).toBe("Ships overlap");
    expect(fleetProblem([...FLEET_A.slice(0, 3), { r: 7, c: 7, len: 2, dir: "h" }])).toBe("Ship off the board");
    for (let i = 0; i < 50; i++) expect(fleetProblem(randomFleet(Math.random))).toBeNull();
  });

  it("starts battle once both fleets are placed, both placing at once", () => {
    let s = g.init([A, B], 0);
    expect(g.turn(s)).toBeNull();
    expect(g.waitingOn!(s)).toEqual([A, B]);
    s = g.apply(s, { type: "place", ships: FLEET_A }, A);
    expect(g.validate(s, { type: "place", ships: FLEET_A }, A)).toMatch(/already placed/);
    expect(g.waitingOn!(s)).toEqual([B]);
    s = g.apply(s, { type: "place", ships: FLEET_B }, B);
    expect(s.phase).toBe("battle");
    expect(g.turn(s)).toBe(A);
  });

  it("never reveals the opponent's fleet before it's sunk", () => {
    const s = placed();
    const v = g.viewFor(s, A) as SeaBattleView;
    expect(v.visible[0]).toEqual(FLEET_A);
    expect(v.visible[1]).toEqual([]);
    expect(JSON.stringify(v)).not.toContain('"c":7');
    const spectator = g.viewFor(s, null) as SeaBattleView;
    expect(spectator.visible).toEqual([[], []]);
  });

  it("records hits and misses, alternates turns, rejects repeats", () => {
    let s = placed();
    s = g.apply(s, { type: "fire", r: 0, c: 7 }, A);
    expect(s.last).toMatchObject({ by: 0, hit: true, sunk: null });
    expect(g.turn(s)).toBe(B);
    expect(g.validate(s, { type: "fire", r: 0, c: 0 }, A)).toBe("Not your turn");
    s = g.apply(s, { type: "fire", r: 7, c: 7 }, B);
    expect(s.last?.hit).toBe(false);
    expect(g.validate(s, { type: "fire", r: 0, c: 7 }, A)).toBe("You already fired there");
  });

  it("reveals a ship when sunk and ends when the fleet is gone", () => {
    let s = placed();
    const targets = [[0, 4], [1, 4]]; // patrol boat (index 3)
    let bobCol = 0;
    for (const [r, c] of targets) {
      s = g.apply(s, { type: "fire", r, c }, A);
      s = g.apply(s, { type: "fire", r: 7, c: bobCol++ }, B);
    }
    expect((g.viewFor(s, A) as SeaBattleView).visible[1]).toEqual([FLEET_B[3]]);
    expect((g.viewFor(s, A) as SeaBattleView).sunk[1]).toEqual([3]);

    const rest = FLEET_B.slice(0, 3).flatMap((ship) =>
      Array.from({ length: ship.len }, (_, i) => [ship.r + i, ship.c]),
    );
    for (const [r, c] of rest) {
      s = g.apply(s, { type: "fire", r, c }, A);
      if (s.winner) break;
      s = g.apply(s, { type: "fire", r: 6 - Math.floor(bobCol / 8), c: bobCol++ % 8 }, B);
    }
    expect(g.winner(s)).toBe(A);
    expect((g.viewFor(s, B) as SeaBattleView).visible[0]).toEqual(FLEET_A); // revealed at the end
  });

  it("auto-places and auto-fires on timeout", () => {
    const s0 = g.init([A, B], 0);
    const m0 = start(g, s0, 0);
    expect(m0.deadline).toBe(60_000);
    const placedA = playerMove(g, s0, m0, { type: "place", ships: FLEET_A }, A, 1000);
    const t = timeout(g, placedA.state, placedA.meta, 60_000, Math.random)!;
    const st = t.state as SeaBattleState;
    expect(st.phase).toBe("battle");
    expect(fleetProblem(st.fleets[1]!)).toBeNull();
    const fire = g.autoMove(st, A, Math.random);
    expect(fire.type).toBe("fire");
    expect(g.validate(st, fire, A)).toBeNull();
  });

  it("auto-fire hunts next to an unfinished hit", () => {
    let s = placed();
    s = g.apply(s, { type: "fire", r: 2, c: 7 }, A); // hit cruiser, not sunk
    s = g.apply(s, { type: "fire", r: 7, c: 0 }, B);
    for (let i = 0; i < 20; i++) {
      const m = g.autoMove(s, A, Math.random) as { r: number; c: number };
      expect(Math.abs(m.r - 2) + Math.abs(m.c - 7)).toBe(1);
    }
  });
});
