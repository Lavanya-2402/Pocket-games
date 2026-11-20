import type { ZodType } from "zod";

/** Player ids in game order: players[0] acts first. Most games take exactly two. */
export type Players = string[];
export type Outcome = string | "draw" | null;

/**
 * Every game implements this. Pure functions only — no I/O — so engines are
 * trivially unit-testable and the server stays the single source of truth.
 */
export interface GameEngine<S, M> {
  id: string;
  name: string;
  /** True if viewFor hides anything (cards, ships, bids). Disables state-in-broadcast. */
  hiddenInfo?: boolean;
  moveSchema: ZodType<M>;
  /** How many can play. Both default to 2. */
  minPlayers?: number;
  maxPlayers?: number;
  /** Optional house rules this game understands, offered as toggles when creating a room. */
  rules?: { id: string; label: string; hint: string }[];
  init(players: Players, seed: number, rules?: Record<string, boolean>): S;
  /** Returns an error message, or null if the move is legal. */
  validate(state: S, move: M, playerId: string): string | null;
  apply(state: S, move: M, playerId: string): S;
  winner(state: S): Outcome;
  /** Whose turn it is (player id), or null if simultaneous / finished. */
  turn(state: S): string | null;
  /** What a given viewer may see. Hides secret info in hidden-info games. */
  viewFor(state: S, viewerId: string | null): unknown;
  /** Players who still need to act. Defaults to [turn] for turn-based games. */
  waitingOn?(state: S): string[];
  /** Seconds allowed for the current turn/round. */
  timeLimit(state: S): number;
  /** A legal move to make on a player's behalf when their time runs out. */
  autoMove(state: S, playerId: string, rng: () => number): M;
  /** The computer opponent's move. Games without this can't be played against the computer. */
  botMove?(state: S, playerId: string, rng: () => number, level: "easy" | "hard"): M;
  /**
   * "step": the computer's moves are made one at a time, a moment apart, so the player
   * can see what happened in between (e.g. each card it flips). Default: it replies at once.
   */
  botPace?: "step";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngine = GameEngine<any, any>;
