import { describe, expect, it } from "vitest";
import { dominoes, fits, type DominoState, type Tile } from "./dominoes";
import { mancala, sow, type MancalaState } from "./mancala";
import { losing, matchsticks } from "./matchsticks";
import { adjacent, makesMatch, matches, N, settle, tileMatch, TURNS, validSwaps } from "./tilematch";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("Tile Match", () => {
  it("starts with no lines but at least one swap that makes one", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = tileMatch.init([A, B], seed);
      expect(matches(s.board).size).toBe(0);
      expect(validSwaps(s.board).length).toBeGreaterThan(0);
      expect(s.board.every((k) => k >= 0 && k < 6)).toBe(true);
    }
  });

  it("only lets neighbours swap, and only when it lines up three", () => {
    expect(adjacent(0, 1)).toBe(true);
    expect(adjacent(N - 1, N)).toBe(false); // end of one row, start of the next
    expect(adjacent(0, N)).toBe(true);
    const s = tileMatch.init([A, B], 4);
    const [a, b] = validSwaps(s.board)[0];
    expect(tileMatch.validate(s, { a, b }, A)).toBeNull();
    expect(tileMatch.validate(s, { a: 0, b: 2 }, A)).toBeTruthy();
    const bad = Array.from({ length: N * N - 1 }, (_, i) => i).find((i) => adjacent(i, i + 1) && !makesMatch(s.board, i, i + 1))!;
    expect(tileMatch.validate(s, { a: bad, b: bad + 1 }, A)).toBeTruthy();
  });

  it("clears lines, drops tiles, and scores chains higher", () => {
    // Bottom row has three 0s; above them three 1s that will NOT line up after falling (they already are a line: clear too).
    const b = Array(N * N).fill(-1);
    for (let c = 0; c < 3; c++) b[(N - 1) * N + c] = 0;
    for (let c = 0; c < 3; c++) b[(N - 2) * N + c] = c === 2 ? 2 : 1;
    b[(N - 3) * N + 2] = 1; // falls two rows when the 0s and... (stays above the 2)
    const r = settle(b, null);
    expect(r.cleared).toBe(3);
    expect(r.pts).toBe(3);
    // The 1,1,2 row fell to the bottom.
    expect(r.board.slice((N - 1) * N, (N - 1) * N + 3)).toEqual([1, 1, 2]);
  });

  it("gives every player the same number of turns and then names the top scorer", () => {
    let s = tileMatch.init([A, B], 9);
    let moves = 0;
    while (!s.winner) {
      const [a, b] = validSwaps(s.board)[0];
      const before = s.scores[s.turn];
      const seat = s.turn;
      s = tileMatch.apply(s, { a, b }, s.players[s.turn]);
      expect(s.scores[seat]).toBeGreaterThanOrEqual(before + 3);
      moves++;
    }
    expect(moves).toBe(TURNS * 2);
    const top = Math.max(...s.scores);
    expect(s.winner).toBe(s.scores[0] === s.scores[1] ? "draw" : s.players[s.scores.indexOf(top)]);
    expect("seed" in (tileMatch.viewFor(s, A) as object)).toBe(false);
  });
});

describe("Dominoes", () => {
  const at = (extra: Partial<DominoState>): DominoState =>
    ({ players: [A, B], hands: [[], []], chain: [], stock: [], turn: 0, passes: 0, last: null, winner: null, ...extra });

  it("deals seven each from a full double-six set", () => {
    const s = dominoes.init([A, B], 3);
    const all = [...s.hands.flat(), ...s.stock];
    expect(all).toHaveLength(28);
    expect(new Set(all.map((t) => t.join("-"))).size).toBe(28);
    expect(s.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(dominoes.init([A, B, "c", "d"], 3).stock).toHaveLength(0);
  });

  it("turns a tile round so the touching numbers match", () => {
    const chain: Tile[] = [[3, 5]];
    expect(fits([5, 6], chain)).toEqual(["right"]);
    expect(fits([3, 5], chain)).toEqual(["left", "right"]);
    expect(fits([1, 2], chain)).toEqual([]);
    let s = dominoes.apply(at({ hands: [[[6, 5], [1, 3]], [[0, 0]]], chain }), { type: "play", tile: 0, side: "right" }, A);
    expect(s.chain).toEqual([[3, 5], [5, 6]]);
    s = dominoes.apply({ ...s, turn: 0 }, { type: "play", tile: 0, side: "left" }, A);
    expect(s.chain).toEqual([[1, 3], [3, 5], [5, 6]]);
    expect(s.winner).toBe(A);
  });

  it("makes you play if you can, draw if you can't, and pass only when the pile is empty", () => {
    const stuck = at({ hands: [[[1, 1]], [[2, 2]]], chain: [[6, 6]], stock: [[0, 6]] });
    expect(dominoes.validate(stuck, { type: "pass" }, A)).toBeTruthy();
    expect(dominoes.validate(stuck, { type: "draw" }, A)).toBeNull();
    const drew = dominoes.apply(stuck, { type: "draw" }, A);
    expect(drew.hands[0]).toEqual([[1, 1], [0, 6]]);
    expect(drew.turn).toBe(0);
    expect(dominoes.validate(drew, { type: "draw" }, A)).toBeTruthy(); // now a tile fits
    const empty = at({ hands: [[[1, 1]], [[2, 2]]], chain: [[6, 6]] });
    expect(dominoes.validate(empty, { type: "draw" }, A)).toBeTruthy();
    expect(dominoes.validate(empty, { type: "pass" }, A)).toBeNull();
  });

  it("gives a blocked game to the lightest hand", () => {
    let s = at({ hands: [[[1, 1]], [[2, 3]]], chain: [[6, 6]] });
    s = dominoes.apply(s, { type: "pass" }, A);
    expect(s.winner).toBeNull();
    s = dominoes.apply(s, { type: "pass" }, B);
    expect(s.winner).toBe(A);
  });

  it("shows you only your own tiles until the game ends", () => {
    const s = dominoes.init([A, B], 3);
    const v = dominoes.viewFor(s, A) as { hand: Tile[]; hands: unknown; stock: unknown };
    expect(v.hand).toEqual(s.hands[0]);
    expect(v.hands).toBeNull();
    expect(v.stock).toBe(14);
    expect(JSON.stringify(dominoes.viewFor(s, null))).not.toContain(JSON.stringify(s.hands[1]));
  });
});

describe("Mancala", () => {
  it("sows anticlockwise, skipping the other store, and goes again from the store", () => {
    const start = mancala.init([A, B], 0).pits;
    const r = sow(start, 0, 2); // 4 stones from pit 2: pits 3, 4, 5 and the store
    expect(r.pits.slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 1]);
    expect(r.again).toBe(true);
    const big = [0, 0, 0, 0, 0, 10, 0, 1, 1, 1, 1, 1, 1, 0];
    const lap = sow(big, 0, 5); // store, six pits, skip store 13, then pits 0-2
    expect(lap.pits[13]).toBe(0);
    expect(lap.pits[6]).toBeGreaterThanOrEqual(1);
  });

  it("captures the opposite pit when the last stone lands in an empty pit of your own", () => {
    const pits = [0, 0, 1, 0, 0, 3, 0, 2, 2, 5, 2, 2, 2, 0];
    const r = sow(pits, 0, 2); // lands in empty pit 3, opposite pit 9 (5 stones)
    expect(r.captured).toBe(6);
    expect(r.pits[6]).toBe(6);
    expect(r.pits[9]).toBe(0);
    expect(r.pits[3]).toBe(0);
  });

  it("ends when one side is empty and counts what is left for the other player", () => {
    const s: MancalaState = { players: [A, B], pits: [0, 0, 0, 0, 0, 1, 20, 3, 0, 0, 0, 0, 0, 10], turn: 0, last: null, winner: null };
    const after = mancala.apply(s, { pit: 5 }, A);
    expect(after.pits[6]).toBe(21);
    expect(after.pits[13]).toBe(13);
    expect(after.winner).toBe(A);
  });
});

describe("Matchsticks", () => {
  it("knows the lost positions", () => {
    expect(losing([1, 0, 0, 0])).toBe(true); // must take the last stick
    expect(losing([1, 1, 0, 0])).toBe(false);
    expect(losing([2, 2, 0, 0])).toBe(true);
    expect(losing([1, 3, 5, 7])).toBe(true); // the classic start is lost for the first player
  });

  it("makes whoever takes the last stick lose", () => {
    let s = matchsticks.init([A, B], 0);
    expect(matchsticks.validate(s, { row: 0, take: 2 }, A)).toBeTruthy();
    s = { ...s, rows: [0, 0, 0, 2] };
    s = matchsticks.apply(s, { row: 3, take: 1 }, A);
    expect(s.winner).toBeNull();
    s = matchsticks.apply(s, { row: 3, take: 1 }, B);
    expect(s.winner).toBe(A);
  });

  it("the hard computer wins from a winning position", () => {
    for (let seed = 0; seed < 10; seed++) {
      let s = { ...matchsticks.init([A, B], 0), rows: [1, 3, 5, 6] }; // not lost for the player to move
      let n = seed;
      const rng = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
      while (!s.winner) {
        const p = s.players[s.turn];
        const move = p === A ? matchsticks.botMove!(s, p, rng, "hard") : matchsticks.autoMove(s, p, rng);
        s = matchsticks.apply(s, move, p);
      }
      expect(s.winner).toBe(A);
    }
  });
});
