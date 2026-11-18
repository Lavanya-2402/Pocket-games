import { describe, expect, it } from "vitest";
import { ticTacToe as g, type TicTacToeState } from "./tictactoe";

const A = "alice";
const B = "bob";

function play(cells: number[]): TicTacToeState {
  let s = g.init([A, B], 0);
  cells.forEach((cell, i) => {
    const p = i % 2 === 0 ? A : B;
    expect(g.validate(s, { cell }, p)).toBeNull();
    s = g.apply(s, { cell }, p);
  });
  return s;
}

describe("tic tac toe", () => {
  it("starts empty with X to move", () => {
    const s = g.init([A, B], 0);
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(g.turn(s)).toBe(A);
  });

  it("rejects wrong player, taken cell, and non-players", () => {
    const s = play([4]);
    expect(g.validate(s, { cell: 0 }, A)).toBe("Not your turn");
    expect(g.validate(s, { cell: 4 }, B)).toBe("Cell already taken");
    expect(g.validate(s, { cell: 0 }, "eve")).toMatch(/not a player/);
  });

  it("detects a win and blocks further moves", () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(g.winner(s)).toBe(A);
    expect(s.line).toEqual([0, 1, 2]);
    expect(g.turn(s)).toBeNull();
    expect(g.validate(s, { cell: 8 }, B)).toBe("Game is over");
  });

  it("detects a draw", () => {
    const s = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(g.winner(s)).toBe("draw");
  });

  it("validates move payloads", () => {
    expect(g.moveSchema.safeParse({ cell: 9 }).success).toBe(false);
    expect(g.moveSchema.safeParse({ cell: 2 }).success).toBe(true);
  });
});
