import { describe, expect, it } from "vitest";
import { begin, newRoomMeta, DEFAULT_OPTIONS, playerMove, wrap } from "@/games/runner";
import { ticTacToe } from "@/games/tictactoe";
import { isDone } from "./cleanup";

const A = "alice";
const B = "bob";

describe("housekeeping: which idle rooms may be deleted", () => {
  it("a room nobody ever started", () => {
    expect(isDone("tictactoe", wrap(null, newRoomMeta(DEFAULT_OPTIONS)))).toBe(true);
    expect(isDone("tictactoe", null)).toBe(true);
  });

  it("not a game that is still being played", () => {
    const g = begin(ticTacToe, [A, B], 1, null, 0);
    expect(isDone("tictactoe", wrap(g.state, g.meta))).toBe(false);
    const one = playerMove(ticTacToe, g.state, g.meta, { cell: 4 }, A, 0);
    expect(isDone("tictactoe", wrap(one.state, one.meta))).toBe(false);
  });

  it("a finished game, including one that ended by forfeit", () => {
    let { state, meta } = begin(ticTacToe, [A, B], 1, null, 0);
    for (const [p, cell] of [[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]] as const) {
      ({ state, meta } = playerMove(ticTacToe, state, meta, { cell }, p, 0));
    }
    expect(isDone("tictactoe", wrap(state, meta))).toBe(true);
    const g = begin(ticTacToe, [A, B], 1, null, 0);
    expect(isDone("tictactoe", wrap(g.state, { ...g.meta, forfeit: A }))).toBe(true);
  });

  it("a room for a game that no longer exists", () => {
    expect(isDone("some-removed-game", { anything: true })).toBe(true);
  });
});
