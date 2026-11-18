import { ticTacToe } from "./tictactoe";
import type { AnyEngine } from "./types";

export const GAMES: Record<string, AnyEngine> = {
  [ticTacToe.id]: ticTacToe,
};

export function getEngine(id: string): AnyEngine | undefined {
  return GAMES[id];
}
