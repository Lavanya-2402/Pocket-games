import { describe, expect, it } from "vitest";
import {
  buildDeck, canPlay, colorRush as g, HAND_SIZE,
  type Card, type ColorRushState, type ColorRushView,
} from "./colorrush";

const A = "alice";
const B = "bob";
const c = (kind: Card["kind"], color: Card["color"], value: number | null, id: number): Card => ({ id, kind, color, value });

/** A hand-built state so tests control exactly what's held. */
function rig(handA: Card[], handB: Card[], topCard: Card, deck: Card[] = []): ColorRushState {
  return {
    players: [A, B], hands: [handA, handB], deck, discard: [topCard], color: topCard.color ?? "coral",
    turn: 0, drew: false, seed: 1, last: null, winner: null,
  };
}

describe("color rush", () => {
  it("builds a 100-card deck and deals 7 each", () => {
    expect(buildDeck()).toHaveLength(100);
    const s = g.init([A, B], 42);
    expect(s.hands[0]).toHaveLength(HAND_SIZE);
    expect(s.hands[1]).toHaveLength(HAND_SIZE);
    expect(s.deck.length + s.discard.length + 14).toBe(100);
    expect(s.discard[0].kind).toBe("num");
    const ids = new Set([...s.deck, ...s.discard, ...s.hands.flat()].map((x) => x.id));
    expect(ids.size).toBe(100);
  });

  it("matches by color, number or symbol; rainbows go on anything", () => {
    const top = c("num", "teal", 5, 0);
    expect(canPlay(c("num", "teal", 2, 1), top, "teal")).toBe(true);
    expect(canPlay(c("num", "gold", 5, 2), top, "teal")).toBe(true);
    expect(canPlay(c("num", "gold", 6, 3), top, "teal")).toBe(false);
    expect(canPlay(c("wild", null, null, 4), top, "teal")).toBe(true);
    expect(canPlay(c("block", "gold", null, 5), c("block", "teal", null, 6), "teal")).toBe(true);
  });

  it("plays a card and passes the turn", () => {
    const s = g.apply(rig([c("num", "coral", 3, 1), c("num", "gold", 9, 2)], [c("num", "teal", 1, 3)], c("num", "coral", 7, 0)),
      { type: "play", card: 1 }, A);
    expect(s.hands[0]).toHaveLength(1);
    expect(s.discard.at(-1)!.id).toBe(1);
    expect(s.turn).toBe(1);
  });

  it("block and +2 keep the turn; +2 makes the opponent draw", () => {
    const deck = [c("num", "teal", 1, 10), c("num", "teal", 2, 11), c("num", "teal", 3, 12)];
    let s = rig([c("block", "coral", null, 1), c("plus2", "coral", null, 2), c("num", "gold", 1, 3)], [c("num", "teal", 9, 4)], c("num", "coral", 7, 0), deck);
    s = g.apply(s, { type: "play", card: 1 }, A);
    expect(s.turn).toBe(0);
    s = g.apply(s, { type: "play", card: 2 }, A);
    expect(s.turn).toBe(0);
    expect(s.hands[1]).toHaveLength(3);
    expect(s.last).toMatchObject({ forced: 2 });
  });

  it("rainbow +4 needs a color, sets it, and makes the opponent draw 4", () => {
    const deck = Array.from({ length: 5 }, (_, i) => c("num", "teal", i, 20 + i));
    const s0 = rig([c("wild4", null, null, 1), c("num", "gold", 1, 2)], [c("num", "teal", 9, 3)], c("num", "coral", 7, 0), deck);
    expect(g.validate(s0, { type: "play", card: 1 }, A)).toBe("Pick a color");
    const s = g.apply(s0, { type: "play", card: 1, color: "violet" }, A);
    expect(s.color).toBe("violet");
    expect(s.hands[1]).toHaveLength(5);
    expect(s.turn).toBe(0);
  });

  it("draw: unplayable passes automatically; playable lets you play or pass", () => {
    const top = c("num", "coral", 7, 0);
    const s1 = g.apply(rig([c("num", "gold", 1, 1)], [c("num", "teal", 9, 2)], top, [c("num", "teal", 3, 9)]), { type: "draw" }, A);
    expect(s1.turn).toBe(1);
    expect(s1.hands[0]).toHaveLength(2);

    const s2 = g.apply(rig([c("num", "gold", 1, 1)], [c("num", "teal", 9, 2)], top, [c("num", "coral", 3, 9)]), { type: "draw" }, A);
    expect(s2.turn).toBe(0);
    expect(s2.drew).toBe(true);
    expect(g.validate(s2, { type: "draw" }, A)).toMatch(/already drew/);
    expect(g.validate(s2, { type: "pass" }, A)).toBeNull();
    const s3 = g.apply(s2, { type: "play", card: 9 }, A);
    expect(s3.turn).toBe(1);
  });

  it("can't pass without drawing, or play out of turn / unmatched", () => {
    const s = rig([c("num", "gold", 1, 1)], [c("num", "coral", 9, 2)], c("num", "coral", 7, 0));
    expect(g.validate(s, { type: "pass" }, A)).toBe("Draw a card first");
    expect(g.validate(s, { type: "play", card: 1 }, A)).toBe("That card doesn't match");
    expect(g.validate(s, { type: "play", card: 2 }, B)).toBe("Not your turn");
    expect(g.validate(s, { type: "play", card: 2 }, A)).toBe("You don't have that card");
  });

  it("reshuffles the discard pile when the deck runs out", () => {
    let s = rig([c("num", "gold", 1, 1)], [c("num", "teal", 9, 2)], c("num", "coral", 7, 0), []);
    s = { ...s, discard: [c("num", "violet", 4, 30), c("num", "violet", 5, 31), c("num", "coral", 7, 0)] };
    s = g.apply(s, { type: "draw" }, A);
    expect(s.hands[0]).toHaveLength(2);
    expect(s.discard).toHaveLength(1);
    expect(s.discard[0].id).toBe(0);
  });

  it("wins when the last card is played", () => {
    const s = g.apply(rig([c("block", "coral", null, 1)], [c("num", "teal", 9, 2)], c("num", "coral", 7, 0)), { type: "play", card: 1 }, A);
    expect(g.winner(s)).toBe(A);
    expect(g.turn(s)).toBeNull();
  });

  it("hides the opponent's hand, the deck and the seed", () => {
    const s = g.init([A, B], 7);
    const v = g.viewFor(s, A) as ColorRushView;
    expect(v.hand).toEqual(s.hands[0]);
    expect(v.counts).toEqual([7, 7]);
    const json = JSON.stringify(v);
    expect(json).not.toContain('"deck"');
    expect(json).not.toContain('"seed"');
    for (const card of s.hands[1]) expect(json).not.toContain(`"id":${card.id},`);
    expect((g.viewFor(s, null) as ColorRushView).hand).toEqual([]);
  });

  it("auto-move plays a match, picks a color for rainbows, else draws then passes", () => {
    const top = c("num", "coral", 7, 0);
    expect(g.autoMove(rig([c("num", "gold", 7, 1)], [], top), A, Math.random)).toEqual({ type: "play", card: 1 });
    expect(g.autoMove(rig([c("wild", null, null, 1), c("num", "teal", 1, 2), c("num", "teal", 2, 3)], [], top), A, Math.random))
      .toEqual({ type: "play", card: 1, color: "teal" });
    const none = rig([c("num", "gold", 1, 1)], [], top);
    expect(g.autoMove(none, A, Math.random)).toEqual({ type: "draw" });
    expect(g.autoMove({ ...none, drew: true }, A, Math.random)).toEqual({ type: "pass" });
  });
});
