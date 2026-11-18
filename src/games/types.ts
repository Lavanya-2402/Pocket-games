import type { ZodType } from "zod";

export type Players = [string, string];
export type Outcome = string | "draw" | null;

/**
 * Every game implements this. Pure functions only — no I/O — so engines are
 * trivially unit-testable and the server stays the single source of truth.
 */
export interface GameEngine<S, M> {
  id: string;
  name: string;
  moveSchema: ZodType<M>;
  init(players: Players, seed: number): S;
  /** Returns an error message, or null if the move is legal. */
  validate(state: S, move: M, playerId: string): string | null;
  apply(state: S, move: M, playerId: string): S;
  winner(state: S): Outcome;
  /** Whose turn it is (player id), or null if simultaneous / finished. */
  turn(state: S): string | null;
  /** What a given viewer may see. Hides secret info in hidden-info games. */
  viewFor(state: S, viewerId: string | null): unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngine = GameEngine<any, any>;
