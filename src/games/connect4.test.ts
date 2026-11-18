import { describe, expect, it } from "vitest";
import { connect4 as g, COLS, ROWS, type Connect4State } from "./connect4";

const A = "alice";
const B = "bob";

function play(cols: number[], start?: Connect4State): Connect4State {
  let s = start ?? g.init([A, B], 0);
  for (const col of cols) {
    const p = s.players[s.turn];
    expect(g.validate(s, { col }, p)).toBeNull();
    s = g.apply(s, { col }, p);
  }
  return s;
}

describe("connect four", () => {
  it("drops pieces to the bottom and stacks them", () => {
    const s = play([3, 3]);
    expect(s.board[ROWS - 1][3]).toBe(0);
    expect(s.board[ROWS - 2][3]).toBe(1);
    expect(s.last).toEqual([ROWS - 2, 3]);
  });

  it("enforces turns and non-players", () => {
    const s = play([0]);
    expect(g.validate(s, { col: 1 }, A)).toBe("Not your turn");
    expect(g.validate(s, { col: 1 }, "eve")).toMatch(/not a player/);
  });

  it("rejects a full column", () => {
    const s = play([0, 0, 0, 0, 0, 0]);
    expect(g.validate(s, { col: 0 }, A)).toBe("Column is full");
  });

  it("detects horizontal, vertical and diagonal wins", () => {
    expect(g.winner(play([0, 0, 1, 1, 2, 2, 3]))).toBe(A);
    expect(g.winner(play([0, 1, 0, 1, 0, 1, 0]))).toBe(A);
    // Diagonal up-right for A: (5,0) (4,1) (3,2) (2,3)
    const d = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(g.winner(d)).toBe(A);
    expect(d.line).toHaveLength(4);
    expect(g.turn(d)).toBeNull();
  });

  it("detects a draw on a full board", () => {
    // Fill columns in pairs, swapping who goes first every 2 rows, then column 6.
    let s = g.init([A, B], 0);
    for (const [x, y] of [[0, 1], [2, 3], [4, 5]]) {
      for (let k = 0; k < 3; k++) s = play(k % 2 === 0 ? [x, y, x, y] : [y, x, y, x], s);
    }
    s = play([6, 6, 6, 6, 6, 6], s);
    expect(s.board.flat().every((c) => c !== null)).toBe(true);
    expect(g.winner(s)).toBe("draw");
  });

  it("validates payloads", () => {
    expect(g.moveSchema.safeParse({ col: COLS }).success).toBe(false);
    expect(g.moveSchema.safeParse({ col: 0 }).success).toBe(true);
  });
});
