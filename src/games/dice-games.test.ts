import { describe, expect, it } from "vitest";
import { climb, JUMPS, LAST } from "./climb";
import { greedy, TARGET, type GreedyState } from "./greedy";
import { HOME, ludo, movable, SAFE, square, type LudoState } from "./ludo";
import { CATS, scoreFor, yacht } from "./yacht";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const cat = (id: string) => CATS.findIndex((c) => c.id === id);

describe("Yacht Dice", () => {
  it("scores every kind of box", () => {
    expect(scoreFor([3, 3, 5, 3, 1], cat("threes"))).toBe(9);
    expect(scoreFor([2, 2, 5, 5, 5], cat("full"))).toBe(19);
    expect(scoreFor([2, 2, 2, 5, 5], cat("four"))).toBe(0);
    expect(scoreFor([6, 6, 6, 6, 2], cat("four"))).toBe(24);
    expect(scoreFor([5, 5, 5, 5, 5], cat("four"))).toBe(20);
    expect(scoreFor([5, 5, 5, 5, 5], cat("full"))).toBe(0);
    expect(scoreFor([5, 3, 1, 4, 2], cat("little"))).toBe(30);
    expect(scoreFor([5, 3, 6, 4, 2], cat("big"))).toBe(30);
    expect(scoreFor([5, 3, 6, 4, 2], cat("little"))).toBe(0);
    expect(scoreFor([1, 2, 3, 4, 6], cat("choice"))).toBe(16);
    expect(scoreFor([4, 4, 4, 4, 4], cat("yacht"))).toBe(50);
    expect(scoreFor([4, 4, 4, 4, 1], cat("yacht"))).toBe(0);
  });

  it("keeps held dice, allows three rolls, and uses each box once", () => {
    let s = yacht.init([A, B], 7);
    expect(yacht.validate(s, { type: "score", cat: 0 }, A)).toBeTruthy(); // must roll first
    s = yacht.apply(s, { type: "roll" }, A);
    const first = s.dice;
    expect(first.every((d) => d >= 1 && d <= 6)).toBe(true);
    s = yacht.apply(s, { type: "roll", hold: [true, true, false, false, false] }, A);
    expect(s.dice.slice(0, 2)).toEqual(first.slice(0, 2));
    expect(yacht.validate(s, { type: "roll", hold: [true, true, true, true, true] }, A)).toBeTruthy();
    s = yacht.apply(s, { type: "roll", hold: [false, false, false, false, false] }, A);
    expect(yacht.validate(s, { type: "roll" }, A)).toBeTruthy(); // out of rolls
    s = yacht.apply(s, { type: "score", cat: cat("choice") }, A);
    expect(s.turn).toBe(1);
    expect(s.cards[0][cat("choice")]).toBeGreaterThan(0);
    // Back to A later: that box is gone.
    s = yacht.apply(yacht.apply(s, { type: "roll" }, B), { type: "score", cat: 0 }, B);
    s = yacht.apply(s, { type: "roll" }, A);
    expect(yacht.validate(s, { type: "score", cat: cat("choice") }, A)).toBeTruthy();
  });

  it("never tells players what the next roll will be", () => {
    expect("seed" in (yacht.viewFor(yacht.init([A, B], 7), A) as object)).toBe(false);
  });
});

describe("Greedy Dice", () => {
  const base: GreedyState = { players: [A, B], scores: [40, 10], pot: 0, turn: 0, seed: 1, last: null, winner: null };
  /** A seed whose next roll matches the test. */
  const seedFor = (test: (d: [number, number]) => boolean) => {
    for (let seed = 1; seed < 5000; seed++) {
      const s = greedy.apply({ ...base, seed }, { type: "roll" }, A);
      if (test(s.last!.dice!)) return seed;
    }
    throw new Error("no seed found");
  };

  it("adds a clean roll to the pot and lets you bank it", () => {
    let s = greedy.apply({ ...base, seed: seedFor(([a, b]) => a > 1 && b > 1) }, { type: "roll" }, A);
    expect(s.pot).toBe(s.last!.amount);
    expect(s.turn).toBe(0);
    const pot = s.pot;
    s = greedy.apply(s, { type: "bank" }, A);
    expect(s.scores[0]).toBe(40 + pot);
    expect(s.turn).toBe(1);
  });

  it("loses the pot on a 1 and everything on two 1s", () => {
    let s = greedy.apply({ ...base, pot: 15, seed: seedFor(([a, b]) => (a === 1) !== (b === 1)) }, { type: "roll" }, A);
    expect([s.pot, s.scores[0], s.turn, s.last!.kind]).toEqual([0, 40, 1, "bust"]);
    s = greedy.apply({ ...base, pot: 15, seed: seedFor(([a, b]) => a === 1 && b === 1) }, { type: "roll" }, A);
    expect([s.pot, s.scores[0], s.turn, s.last!.kind]).toEqual([0, 0, 1, "wipe"]);
  });

  it("can't bank an empty pot, and banking past the target wins", () => {
    expect(greedy.validate(base, { type: "bank" }, A)).toBeTruthy();
    const s = greedy.apply({ ...base, scores: [TARGET - 5, 0], pot: 6 }, { type: "bank" }, A);
    expect(s.winner).toBe(A);
  });
});

describe("Climb & Slide", () => {
  it("has ropes and slides that never chain or sit on the last square", () => {
    for (const [from, to] of Object.entries(JUMPS)) {
      expect(JUMPS[to]).toBeUndefined();
      expect(Number(from)).toBeLessThan(LAST);
      expect(to).toBeGreaterThan(0);
    }
  });

  it("moves by the roll, follows a jump, and gives a six another go", () => {
    let s = climb.init([A, B, C], 3);
    for (let i = 0; i < 400 && !s.winner; i++) {
      const before = s;
      const p = s.players[s.turn];
      s = climb.apply(s, { type: "roll" }, p);
      const l = s.last!;
      expect(l.landed).toBe(Math.min(LAST, l.from + l.roll));
      expect(l.to).toBe(JUMPS[l.landed] ?? l.landed);
      if (!s.winner) expect(s.turn).toBe(l.roll === 6 ? before.turn : (before.turn + 1) % 3);
    }
    expect(s.winner).toBeTruthy();
  });
});

describe("Ludo", () => {
  const at = (pieces: number[][], extra: Partial<LudoState> = {}): LudoState =>
    ({ players: [A, B], pieces, turn: 0, roll: null, sixes: 0, seed: 1, last: null, winner: null, ...extra });

  it("needs a 6 to leave the yard and an exact roll to get home", () => {
    const s = at([[-1, 10, 54, HOME], [-1, -1, -1, -1]]);
    expect(movable(s, 0, 6)).toEqual([0, 1]);
    expect(movable(s, 0, 2)).toEqual([1, 2]);
    expect(movable(s, 0, 3)).toEqual([1]);
  });

  it("puts two players on opposite corners", () => {
    expect(square(2, 0, 0)).toBe(0);
    expect(square(2, 1, 0)).toBe(26);
    expect(square(4, 3, 0)).toBe(39);
    expect(square(4, 1, 50)).toBe(11); // one short of its own start
  });

  it("sends a piece back to the yard when landed on, and rolls again", () => {
    // B's start is square 26; a B piece 4 steps out stands on square 30. A lands there from 27.
    const s = ludo.apply(at([[27, -1, -1, -1], [4, -1, -1, -1]], { roll: 3 }), { type: "move", piece: 0 }, A);
    expect(s.pieces[1][0]).toBe(-1);
    expect(s.last!.hit).toEqual([1]);
    expect(s.turn).toBe(0);
  });

  it("can't capture on a safe square", () => {
    expect(SAFE).toContain(34);
    // B piece 8 steps out is on the star at 34.
    const s = ludo.apply(at([[30, -1, -1, -1], [8, -1, -1, -1]], { roll: 4 }), { type: "move", piece: 0 }, A);
    expect(s.pieces[1][0]).toBe(8);
    expect(s.turn).toBe(1);
  });

  it("wins when the last piece gets home, with two pieces in a quick game", () => {
    expect(ludo.init([A, B], 1, { quick: true }).pieces[0]).toHaveLength(2);
    const s = ludo.apply(at([[HOME, 53], [-1, -1]], { roll: 3 }), { type: "move", piece: 1 }, A);
    expect(s.winner).toBe(A);
  });

  it("passes the turn when nothing can move", () => {
    let s = at([[-1, -1, -1, -1], [-1, -1, -1, -1]]);
    // Roll until a non-six comes up with everything in the yard: the turn must pass.
    for (let seed = 1; seed < 50; seed++) {
      s = ludo.apply({ ...s, seed, turn: 0, sixes: 0 }, { type: "roll" }, A);
      if (s.last!.roll !== 6) {
        expect(s.last!.note).toBe("stuck");
        expect(s.turn).toBe(1);
        return;
      }
    }
    throw new Error("only sixes?");
  });
});
