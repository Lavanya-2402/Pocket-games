import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Code Breaker: each player hides a 4-digit code (no repeated digits). Take turns
 * guessing the other's code. After each guess you learn how many digits are right and
 * in the right place, and how many are right but in the wrong place.
 * Both players always get the same number of guesses, so cracking it in the same
 * round is a draw.
 */

export const LEN = 4;
export const MAX_GUESSES = 10;
type Seat = 0 | 1;

export interface Guess { code: string; exact: number; near: number }

export interface CodeBreakerState {
  players: Players;
  phase: "set" | "guess";
  secrets: [string | null, string | null];
  /** guesses[i] = the guesses seat i has made at the other player's code. */
  guesses: [Guess[], Guess[]];
  turn: Seat;
  winner: Outcome;
}

export type CodeBreakerMove = { type: "set"; code: string } | { type: "guess"; code: string };

export type CodeBreakerView = Omit<CodeBreakerState, "secrets"> & {
  /** Your own code; the other one only once the game is over. */
  secrets: [string | null, string | null];
  ready: [boolean, boolean];
};

export const validCode = (code: string) => new RegExp(`^\\d{${LEN}}$`).test(code) && new Set(code).size === LEN;

export function feedback(secret: string, guess: string) {
  let exact = 0, near = 0;
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === secret[i]) exact++;
    else if (secret.includes(guess[i])) near++;
  }
  return { exact, near };
}

let ALL: string[] | null = null;
function allCodes() {
  if (!ALL) {
    ALL = [];
    for (let n = 0; n < 10 ** LEN; n++) {
      const code = String(n).padStart(LEN, "0");
      if (validCode(code)) ALL.push(code);
    }
  }
  return ALL;
}

const codeSchema = z.string().refine(validCode, "Use 4 different digits");

export const codeBreaker: GameEngine<CodeBreakerState, CodeBreakerMove> = {
  id: "codebreaker",
  name: "Code Breaker",
  hiddenInfo: true,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("set"), code: codeSchema }),
    z.object({ type: z.literal("guess"), code: codeSchema }),
  ]),

  init(players) {
    return { players, phase: "set", secrets: [null, null], guesses: [[], []], turn: 0, winner: null };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (m.type === "set") {
      if (s.phase !== "set") return "Codes are already set";
      return s.secrets[seat] ? "You already set your code" : null;
    }
    if (s.phase !== "guess") return "Waiting for both codes";
    if (seat !== s.turn) return "Not your turn";
    if (s.guesses[seat].some((g) => g.code === m.code)) return "You already tried that code";
    return null;
  },

  apply(s, m, playerId) {
    const seat = s.players.indexOf(playerId) as Seat;
    if (m.type === "set") {
      const secrets: CodeBreakerState["secrets"] = [...s.secrets];
      secrets[seat] = m.code;
      return { ...s, secrets, phase: secrets[0] && secrets[1] ? "guess" : "set" };
    }
    const opp = (1 - seat) as Seat;
    const guesses: CodeBreakerState["guesses"] = [[...s.guesses[0]], [...s.guesses[1]]];
    guesses[seat].push({ code: m.code, ...feedback(s.secrets[opp]!, m.code) });

    // Decide only when both have had the same number of guesses.
    let winner: Outcome = null;
    if (guesses[0].length === guesses[1].length) {
      const cracked = [0, 1].map((i) => guesses[i].at(-1)!.exact === LEN);
      if (cracked[0] && cracked[1]) winner = "draw";
      else if (cracked[0] || cracked[1]) winner = s.players[cracked[0] ? 0 : 1];
      else if (guesses[0].length >= MAX_GUESSES) winner = "draw";
    }
    return { ...s, guesses, turn: opp, winner };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner || s.phase === "set" ? null : s.players[s.turn]),
  waitingOn: (s) => (s.phase === "set" ? s.players.filter((_, i) => !s.secrets[i]) : [s.players[s.turn]]),
  timeLimit: () => 45,

  autoMove(s, p, rng) {
    return codeBreaker.botMove!(s, p, rng, "easy");
  },

  // Hard only ever guesses codes that fit every clue so far. Easy sometimes guesses blind.
  botMove(s, playerId, rng, level) {
    const seat = s.players.indexOf(playerId) as Seat;
    if (s.phase === "set") return { type: "set", code: pick(allCodes(), rng) };
    const tried = new Set(s.guesses[seat].map((g) => g.code));
    const untried = allCodes().filter((c) => !tried.has(c));
    if (level === "easy" && rng() < 0.5) return { type: "guess", code: pick(untried, rng) };
    const fits = untried.filter((c) => s.guesses[seat].every((g) => {
      const f = feedback(c, g.code);
      return f.exact === g.exact && f.near === g.near;
    }));
    return { type: "guess", code: pick(fits.length ? fits : untried, rng) };
  },

  viewFor(s, viewerId): CodeBreakerView {
    const me = viewerId ? s.players.indexOf(viewerId) : -1;
    const show = (i: number) => (i === me || s.winner ? s.secrets[i] : null);
    return { ...s, secrets: [show(0), show(1)], ready: [!!s.secrets[0], !!s.secrets[1]] };
  },
};
