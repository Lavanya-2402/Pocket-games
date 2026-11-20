import { describe, expect, it } from "vitest";
import { codeBreaker as cb, feedback, MAX_GUESSES, validCode, type CodeBreakerView } from "./codebreaker";
import { memory as mem, pairsWon, type MemoryState, type MemoryView } from "./memory";

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
