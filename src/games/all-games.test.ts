import { describe, expect, it } from "vitest";
import { GAMES } from "./index";
import { BOT_ID, begin, botTurns, DEFAULT_OPTIONS, newRoomMeta, outcome, playerMove, waitingOn } from "./runner";
import { rngFrom } from "./util";

/**
 * Checks every registered game the same way, so a new game can't be added without
 * meeting the platform's assumptions.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const MAX_STEPS = 4000;

describe.each(Object.values(GAMES).map((g) => [g.name, g] as const))("%s", (_name, engine) => {
  it("plays to a finish using only automatic moves, never making an illegal one", () => {
    for (let game = 0; game < 12; game++) {
      const rng = rngFrom(1000 + game).next;
      let { state, meta } = begin(engine, game % 2 ? [A, B] : [B, A], 77 + game, null, 0);
      let steps = 0;
      while (outcome(engine, state, meta) === null) {
        const waiting = waitingOn(engine, state);
        expect(waiting.length, "someone must be able to act").toBeGreaterThan(0);
        const p = waiting[Math.floor(rng() * waiting.length)];
        const move = engine.autoMove(state, p, rng);
        expect(engine.moveSchema.safeParse(move).success, `move shape ${JSON.stringify(move)}`).toBe(true);
        expect(engine.validate(state, move, p), `auto move ${JSON.stringify(move)}`).toBeNull();
        ({ state, meta } = playerMove(engine, state, meta, move, p, 0));
        expect(++steps).toBeLessThan(MAX_STEPS);
      }
      expect(meta.resultId).toBeTruthy();
    }
  });

  it("keeps its state as plain JSON (it is stored in the database)", () => {
    const { state } = begin(engine, [A, B], 5, null, 0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("rejects moves from someone who isn't playing", () => {
    const { state } = begin(engine, [A, B], 5, null, 0);
    const move = engine.autoMove(state, waitingOn(engine, state)[0], Math.random);
    expect(engine.validate(state, move, "33333333-3333-4333-8333-333333333333")).toBeTruthy();
  });

  it("gives spectators a view without crashing, and a positive turn time", () => {
    const { state } = begin(engine, [A, B], 5, null, 0);
    expect(engine.viewFor(state, null)).toBeTruthy();
    expect(engine.viewFor(state, A)).toBeTruthy();
    expect(engine.timeLimit(state)).toBeGreaterThan(0);
  });

  if (engine.botMove) {
    it.each(["easy", "hard"] as const)("can be played against the computer (%s)", (level) => {
      for (let game = 0; game < 6; game++) {
        const rng = rngFrom(500 + game).next;
        const players: [string, string] = game % 2 ? [A, BOT_ID] : [BOT_ID, A];
        let { state, meta } = begin(engine, players, 9 + game, newRoomMeta({ ...DEFAULT_OPTIONS, bot: level }), 0);
        ({ state, meta } = botTurns(engine, state, meta, 0, rng));
        let steps = 0;
        while (outcome(engine, state, meta) === null) {
          // After the computer has acted, only the human can be waiting.
          expect(waitingOn(engine, state)).toEqual([A]);
          const move = engine.autoMove(state, A, rng);
          ({ state, meta } = playerMove(engine, state, meta, move, A, 0));
          ({ state, meta } = botTurns(engine, state, meta, 0, rng));
          expect(++steps).toBeLessThan(MAX_STEPS);
        }
      }
    }, 30_000);
  }
});
