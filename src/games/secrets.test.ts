import { describe, expect, it } from "vitest";
import { codeBreaker as cb, feedback, MAX_GUESSES, validCode, type CodeBreakerView } from "./codebreaker";
import { DICE, liarsDice as ld, type LiarsDiceState, type LiarsDiceView } from "./liarsdice";
import { memory as mem, pairsWon, type MemoryState, type MemoryView } from "./memory";
import { minefield as mf, MINES, SIZE as MF, TARGET, type MinefieldState, type MinefieldView } from "./minefield";

const A = "alice";
const B = "bob";

describe("code breaker", () => {
  it("scores guesses", () => {
    expect(feedback("1234", "1234")).toEqual({ exact: 4, near: 0 });
    expect(feedback("1234", "4321")).toEqual({ exact: 0, near: 4 });
    expect(feedback("1234", "1560")).toEqual({ exact: 1, near: 0 });
    expect(feedback("1234", "5621")).toEqual({ exact: 0, near: 2 });
    expect(validCode("1123")).toBe(false);
    expect(validCode("123")).toBe(false);
    expect(validCode("0957")).toBe(true);
  });

  const started = () => {
    let s = cb.init([A, B], 0);
    s = cb.apply(s, { type: "set", code: "1234" }, A);
    expect(cb.waitingOn!(s)).toEqual([B]);
    return cb.apply(s, { type: "set", code: "5678" }, B);
  };

  it("never shows the other player's code until the game is over", () => {
    const s = started();
    const forA = cb.viewFor(s, A) as CodeBreakerView;
    expect(forA.secrets).toEqual(["1234", null]);
    expect(JSON.stringify(forA)).not.toContain("5678");
    expect((cb.viewFor(s, null) as CodeBreakerView).secrets).toEqual([null, null]);
    expect((cb.viewFor(s, null) as CodeBreakerView).ready).toEqual([true, true]);
  });

  it("gives both players the same number of guesses", () => {
    let s = started();
    s = cb.apply(s, { type: "guess", code: "5678" }, A); // A cracks it first…
    expect(cb.winner(s)).toBeNull(); // …but B still gets this round's guess
    expect(cb.turn(s)).toBe(B);
    const bMisses = cb.apply(s, { type: "guess", code: "9876" }, B);
    expect(cb.winner(bMisses)).toBe(A);
    expect((cb.viewFor(bMisses, B) as CodeBreakerView).secrets).toEqual(["1234", "5678"]); // revealed
    const bAlsoCracks = cb.apply(s, { type: "guess", code: "1234" }, B);
    expect(cb.winner(bAlsoCracks)).toBe("draw");
  });

  it("second player can win outright, and repeats are refused", () => {
    let s = started();
    s = cb.apply(s, { type: "guess", code: "0123" }, A);
    expect(cb.validate(s, { type: "guess", code: "1234" }, A)).toBe("Not your turn");
    s = cb.apply(s, { type: "guess", code: "1234" }, B);
    expect(cb.winner(s)).toBe(B);
    const again = cb.apply(cb.apply(started(), { type: "guess", code: "0123" }, A), { type: "guess", code: "9012" }, B);
    expect(cb.validate(again, { type: "guess", code: "0123" }, A)).toBe("You already tried that code");
  });

  it("is a draw if nobody cracks it in time", () => {
    let s = started();
    const wrong = ["0129", "0139", "0149", "0159", "0169", "0179", "0189", "0219", "0319", "0419"];
    for (let i = 0; i < MAX_GUESSES; i++) {
      s = cb.apply(s, { type: "guess", code: wrong[i] }, A);
      s = cb.apply(s, { type: "guess", code: wrong[i] }, B);
    }
    expect(cb.winner(s)).toBe("draw");
  });

  it("the hard computer only guesses codes that fit every clue", () => {
    let s = started();
    s = cb.apply(s, { type: "guess", code: "5612" }, A); // 2 exact vs 5678
    s = cb.apply(s, { type: "guess", code: "9012" }, B);
    for (let i = 0; i < 30; i++) {
      const m = cb.botMove!(s, A, Math.random, "hard") as { code: string };
      expect(feedback(m.code, "5612")).toEqual(feedback("5678", "5612"));
    }
  });
});

describe("memory match", () => {
  /** A deck where card i pairs with card i+1 (0-1, 2-3, …). */
  const rig = (): MemoryState => ({ ...mem.init([A, B], 1), cards: Array.from({ length: 20 }, (_, i) => Math.floor(i / 2)) });

  it("hides faces until flipped, and never sends the deck", () => {
    const s = mem.init([A, B], 3);
    const v = mem.viewFor(s, A) as MemoryView;
    expect(v.faces.every((f) => f === null)).toBe(true);
    expect("cards" in v).toBe(false);
    const one = mem.apply(s, { card: 4 }, A);
    const v1 = mem.viewFor(one, B) as MemoryView;
    expect(v1.faces.filter((f) => f !== null)).toHaveLength(1);
    expect(v1.faces[4]).toBe(one.cards[4]);
  });

  it("a pair scores and keeps the turn", () => {
    let s = rig();
    s = mem.apply(s, { card: 0 }, A);
    expect(mem.validate(s, { card: 0 }, A)).toBe("Pick a different card");
    s = mem.apply(s, { card: 1 }, A);
    expect(pairsWon(s)).toEqual([1, 0]);
    expect(mem.turn(s)).toBe(A);
    expect(s.up).toEqual([]);
    expect(mem.validate(s, { card: 0 }, A)).toBe("That pair is already taken");
  });

  it("a mismatch stays visible, passes the turn, then turns back over", () => {
    let s = rig();
    s = mem.apply(s, { card: 0 }, A);
    s = mem.apply(s, { card: 2 }, A);
    expect(mem.turn(s)).toBe(B);
    expect((mem.viewFor(s, B) as MemoryView).faces.filter((f) => f !== null)).toHaveLength(2);
    s = mem.apply(s, { card: 5 }, B);
    const v = mem.viewFor(s, A) as MemoryView;
    expect(v.faces[0]).toBeNull();
    expect(v.faces[2]).toBeNull();
    expect(v.faces[5]).not.toBeNull();
    expect(s.seen[0] && s.seen[2] && s.seen[5]).toBe(true);
  });

  it("the computer uses what has been seen, and nothing else", () => {
    let s = rig();
    s = mem.apply(s, { card: 0 }, A);
    s = mem.apply(s, { card: 2 }, A); // mismatch; cards 0 and 2 are now known
    s = mem.apply(s, { card: 1 }, B); // B turns over the partner of card 0
    const hard = () => 0.99; // never "forgets"
    expect(mem.botMove!(s, B, hard, "hard")).toEqual({ card: 0 });
    // With nothing known to match, it tries a card nobody has seen.
    const fresh = mem.apply(rig(), { card: 6 }, A);
    const pickUnseen = mem.botMove!(fresh, A, hard, "hard") as { card: number };
    expect(fresh.seen[pickUnseen.card]).toBe(false);
  });

  it("ends when all pairs are taken", () => {
    let s = rig();
    for (let i = 0; i < 20; i += 2) {
      s = mem.apply(s, { card: i }, A);
      s = mem.apply(s, { card: i + 1 }, A);
    }
    expect(mem.winner(s)).toBe(A);
    expect((mem.viewFor(s, B) as MemoryView).faces.every((f) => f !== null)).toBe(true);
  });
});

describe("minefield duel", () => {
  /** A field with mines along the top row of the first MINES squares. */
  const rig = (): MinefieldState => {
    const s = mf.init([A, B], 1);
    return { ...s, mines: s.mines.map((_, i) => i < MINES) };
  };

  it("never sends the mine layout while the game is on", () => {
    const s = mf.init([A, B], 9);
    expect(s.mines.filter(Boolean)).toHaveLength(MINES);
    const v = mf.viewFor(s, A) as MinefieldView;
    expect(v.mines).toBeNull();
    expect(v.cells.every((c) => c === null)).toBe(true);
  });

  it("finding a mine scores and keeps the turn", () => {
    let s = rig();
    s = mf.apply(s, { cell: 0 }, A);
    expect(s.found).toEqual([1, 0]);
    expect(s.cells[0]).toBe(10);
    expect(mf.turn(s)).toBe(A);
    expect(mf.validate(s, { cell: 0 }, A)).toBe("That square is already open");
  });

  it("a safe square shows its count, opens empty areas, and ends the turn", () => {
    let s = rig();
    const far = MF * MF - 1; // bottom-right corner: nowhere near the mines
    s = mf.apply(s, { cell: far }, A);
    expect(s.cells[far]).toBe(0);
    expect(s.cells.filter((c) => c !== null).length).toBeGreaterThan(10); // flood opened a region
    expect(s.cells.some((c) => c !== null && c >= 10)).toBe(false); // but never a mine
    expect(mf.turn(s)).toBe(B);
  });

  it("first to find most of the mines wins, and the rest are then revealed", () => {
    let s = rig();
    for (let i = 0; i < TARGET; i++) s = mf.apply(s, { cell: i }, A);
    expect(mf.winner(s)).toBe(A);
    expect((mf.viewFor(s, B) as MinefieldView).mines).toEqual(s.mines);
  });

  it("the computer takes a mine it can deduce", () => {
    // One mine in the corner; open the three squares around it so the 1s pin it down.
    let s: MinefieldState = { ...mf.init([A, B], 1) };
    s = { ...s, mines: s.mines.map((_, i) => i === 0) };
    const cells = [...s.cells];
    cells[1] = 1; cells[MF] = 1; cells[MF + 1] = 1;
    // Every other square near those numbers is open and safe, leaving only the corner.
    for (const i of [2, MF + 2, 2 * MF, 2 * MF + 1, 2 * MF + 2]) cells[i] = 0;
    s = { ...s, cells };
    expect(mf.botMove!(s, A, Math.random, "hard")).toEqual({ cell: 0 });
  });
});

describe("liar's dice", () => {
  const rig = (a: number[], b: number[]): LiarsDiceState => ({ ...ld.init([A, B], 4), dice: [a, b] });

  it("each player sees only their own dice, and never the seed", () => {
    const s = ld.init([A, B], 11);
    expect(s.dice[0]).toHaveLength(DICE);
    const forA = ld.viewFor(s, A) as LiarsDiceView;
    expect(forA.hand).toEqual(s.dice[0]);
    expect(forA.counts).toEqual([DICE, DICE]);
    expect("dice" in forA || "seed" in forA).toBe(false);
    expect((ld.viewFor(s, null) as LiarsDiceView).hand).toEqual([]);
  });

  it("bids must go up", () => {
    let s = rig([1, 1, 2, 3, 4], [2, 2, 5, 6, 6]);
    expect(ld.validate(s, { type: "call" }, A)).toBe("There is no bid to call yet");
    s = ld.apply(s, { type: "bid", q: 2, face: 3 }, A);
    expect(ld.validate(s, { type: "bid", q: 2, face: 3 }, B)).toMatch(/Bid higher/);
    expect(ld.validate(s, { type: "bid", q: 2, face: 2 }, B)).toMatch(/Bid higher/);
    expect(ld.validate(s, { type: "bid", q: 2, face: 4 }, B)).toBeNull();
    expect(ld.validate(s, { type: "bid", q: 3, face: 1 }, B)).toBeNull();
    expect(ld.validate(s, { type: "bid", q: 11, face: 1 }, B)).toMatch(/aren't that many/);
  });

  it("a true bid costs the caller a die; a bluff costs the bidder", () => {
    const start = rig([1, 1, 2, 3, 4], [2, 2, 5, 6, 6]); // three 2s in total
    const truthful = ld.apply(ld.apply(start, { type: "bid", q: 3, face: 2 }, A), { type: "call" }, B);
    expect(truthful.reveal).toMatchObject({ count: 3, caller: 1, loser: 1 });
    expect((ld.viewFor(truthful, A) as LiarsDiceView).counts).toEqual([5, 4]);
    expect(ld.turn(truthful)).toBe(B); // the loser opens the next round
    expect(truthful.round).toBe(2);
    expect(truthful.bid).toBeNull();
    // The showdown shows everyone's dice from the round that just ended.
    expect((ld.viewFor(truthful, B) as LiarsDiceView).reveal!.dice).toEqual(start.dice);

    const bluff = ld.apply(ld.apply(start, { type: "bid", q: 4, face: 2 }, A), { type: "call" }, B);
    expect(bluff.reveal).toMatchObject({ count: 3, loser: 0 });
    expect((ld.viewFor(bluff, A) as LiarsDiceView).counts).toEqual([4, 5]);
  });

  it("losing your last die loses the game", () => {
    const s = rig([3], [4, 4]);
    const end = ld.apply(ld.apply(s, { type: "bid", q: 3, face: 4 }, A), { type: "call" }, B);
    expect(ld.winner(end)).toBe(B);
    expect((ld.viewFor(end, A) as LiarsDiceView).counts).toEqual([0, 2]);
  });

  it("the hard computer calls an impossible bid and raises a likely one", () => {
    const s = rig([1, 1, 1, 1, 1], [2, 3, 4, 5, 6]);
    const wild = ld.apply(s, { type: "bid", q: 8, face: 6 }, A);
    expect(ld.botMove!(wild, B, Math.random, "hard")).toEqual({ type: "call" });
    const tame = ld.apply(s, { type: "bid", q: 1, face: 1 }, A);
    expect(ld.botMove!(tame, B, Math.random, "hard").type).toBe("bid");
  });
});
