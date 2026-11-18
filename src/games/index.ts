import { bidTacToe } from "./bidtactoe";
import { connect4 } from "./connect4";
import { duel } from "./duel";
import { ticTacToe } from "./tictactoe";
import type { AnyEngine } from "./types";

export const GAMES: Record<string, AnyEngine> = {
  [ticTacToe.id]: ticTacToe,
  [connect4.id]: connect4,
  [bidTacToe.id]: bidTacToe,
  [duel.id]: duel,
};

export function getEngine(id: string): AnyEngine | undefined {
  return GAMES[id];
}
