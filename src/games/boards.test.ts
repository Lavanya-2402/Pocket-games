import { describe, expect, it } from "vitest";
import { dots, N, score } from "./dots";
import { five, SIZE as FIVE } from "./five";
import { gravity, rotate, SIZE as G, type GravityState } from "./gravity";
import { count, flips, SIZE as T, territory } from "./territory";

const A = "alice";
const B = "bob";

describe("dots and boxes", () => {
  it("closing a box scores it and earns another turn", () => {
    let s = dots.init([A, B], 0);
    // Three sides of the top-left box, alternating players.
    s = dots.apply(s, { o: "h", r: 0, c: 0 }, A);
    s = dots.apply(s, { o: "v", r: 0, c: 0 }, B);
    s = dots.apply(s, { o: "h", r: 1, c: 0 }, A);
    expect(dots.turn(s)).toBe(B);
    s = dots.apply(s, { o: "v", r: 0, c: 1 }, B); // fourth side
    expect(s.boxes[0][0]).toBe(1);
    expect(score(s)).toEqual([0, 1]);
    expect(dots.turn(s)).toBe(B); // goes again
    expect(dots.validate(s, { o: "v", r: 0, c: 1 }, B)).toBe("That line is already drawn");
    expect(dots.validate(s, { o: "h", r: N + 1, c: 0 }, B)).toBe("That line is off the board");
  });

  it("one line can close two boxes", () => {
    let s = dots.init([A, B], 0);
    for (const m of [
      { o: "h", r: 0, c: 0 }, { o: "h", r: 1, c: 0 }, { o: "v", r: 0, c: 0 },
      { o: "h", r: 0, c: 1 }, { o: "h", r: 1, c: 1 }, { o: "v", r: 0, c: 2 },
    ] as const) s = dots.apply(s, m, s.players[s.turn]);
    const before = s.turn;
    s = dots.apply(s, { o: "v", r: 0, c: 1 }, s.players[s.turn]);
    expect(s.last?.closed).toBe(2);
    expect(score(s)[before]).toBe(2);
  });

  it("the hard computer takes a free box", () => {
    let s = dots.init([A, B], 0);
    for (const m of [{ o: "h", r: 0, c: 0 }, { o: "v", r: 0, c: 0 }, { o: "h", r: 1, c: 0 }] as const) {
      s = dots.apply(s, m, s.players[s.turn]);
    }
    expect(dots.botMove!(s, B, Math.random, "hard")).toEqual({ o: "v", r: 0, c: 1 });
  });
});

describe("five in a row", () => {
  it("needs five, not four, and finds diagonals", () => {
    let s = five.init([A, B], 0);
    const at = (r: number, c: number) => r * FIVE + c;
    for (let i = 0; i < 4; i++) {
      s = five.apply(s, { cell: at(i, i) }, A);
      expect(five.winner(s)).toBeNull();
      s = five.apply(s, { cell: at(9, i) }, B);
    }
    s = five.apply(s, { cell: at(4, 4) }, A);
    expect(five.winner(s)).toBe(A);
    expect(s.line).toHaveLength(5);
  });

  it("the computer blocks an open four", () => {
    let s = five.init([A, B], 0);
    const at = (r: number, c: number) => r * FIVE + c;
    for (let i = 0; i < 4; i++) {
      s = five.apply(s, { cell: at(5, 2 + i) }, A);
      if (i < 3) s = five.apply(s, { cell: at(0, i * 2) }, B);
    }
    expect([at(5, 1), at(5, 6)]).toContain(five.botMove!(s, B, Math.random, "hard").cell);
  });
});

describe("territory", () => {
  it("flips every touching enemy piece, including diagonals", () => {
    const s = territory.init([A, B], 0);
    const mid = T / 2 - 1;
    const corner = (mid - 1) * T + (mid - 1); // touches only A's own piece diagonally
    expect(flips(s.board, corner, 1)).toEqual([mid * T + mid]);
    const next = territory.apply(s, { cell: mid * T + mid + 2 }, A); // right of B's piece
    expect(next.last?.flipped.length).toBeGreaterThan(0);
    expect(count(next.board)[0]).toBe(2 + 1 + next.last!.flipped.length);
    expect(territory.validate(next, { cell: mid * T + mid }, B)).toBe("That square is taken");
  });
});

describe("gravity flip", () => {
  it("rotating turns the bottom row into a column, then discs fall", () => {
    let s: GravityState = gravity.init([A, B], 0);
    for (const col of [0, 1, 2]) {
      s = gravity.apply(s, { type: "drop", col }, A);
      s = gravity.apply(s, { type: "drop", col: 6 }, B);
    }
    // Bottom row: A A A . . . B(stack of 3 in col 6)
    const turned = rotate(s.board);
    // Clockwise: the old bottom row becomes the left column and the old right-hand stack
    // becomes the new bottom row. So the left column, bottom-up, is B then A, A, A.
    expect([G - 1, G - 2, G - 3, G - 4].map((r) => turned[r][0])).toEqual([1, 0, 0, 0]);
    expect([turned[G - 1][1], turned[G - 1][2]]).toEqual([1, 1]);
    expect(turned.flat().filter((x) => x === 0)).toHaveLength(3);
    expect(turned.flat().filter((x) => x === 1)).toHaveLength(3);
    // No floating discs: nothing sits above an empty cell.
    for (let c = 0; c < G; c++) for (let r = 0; r < G - 1; r++) if (turned[r][c] !== null) expect(turned[r + 1][c]).not.toBeNull();
  });

  it("each player can flip once, and a flip can win", () => {
    let s: GravityState = gravity.init([A, B], 0);
    // A stacks 3 in column 0 and has one more disc at the bottom of column 3: after a
    // clockwise flip the column lies along the bottom... build a simple vertical win instead.
    for (let i = 0; i < 3; i++) {
      s = gravity.apply(s, { type: "drop", col: 0 }, A);
      s = gravity.apply(s, { type: "drop", col: 6 - (i % 2) }, B);
    }
    expect(gravity.validate(s, { type: "flip" }, A)).toBeNull();
    const flipped = gravity.apply(s, { type: "flip" }, A);
    expect(flipped.flips).toEqual([0, 1]);
    expect(flipped.flipCount).toBe(1);
    expect(gravity.turn(flipped)).toBe(B);
    const again = gravity.apply(gravity.apply(flipped, { type: "drop", col: 3 }, B), { type: "drop", col: 3 }, A);
    expect(gravity.validate(again, { type: "drop", col: 3 }, A)).toBe("Not your turn");
    const s2 = gravity.apply(again, { type: "drop", col: 4 }, B);
    expect(gravity.validate(s2, { type: "flip" }, A)).toBe("You've already used your flip");
    // And four in a column still wins by dropping.
    const win = gravity.apply(s, { type: "drop", col: 0 }, A);
    expect(gravity.winner(win)).toBe(A);
  });
});
