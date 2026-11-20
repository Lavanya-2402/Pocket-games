import { bidTacToe } from "./bidtactoe";
import { codeBreaker } from "./codebreaker";
import { colorRush } from "./colorrush";
import { connect4 } from "./connect4";
import { dots } from "./dots";
import { duel } from "./duel";
import { five } from "./five";
import { gravity } from "./gravity";
import { memory } from "./memory";
import { seaBattle } from "./seabattle";
import { territory } from "./territory";
import { ticTacToe } from "./tictactoe";
import type { AnyEngine } from "./types";

export const GAMES: Record<string, AnyEngine> = {
  [ticTacToe.id]: ticTacToe,
  [connect4.id]: connect4,
  [bidTacToe.id]: bidTacToe,
  [duel.id]: duel,
  [seaBattle.id]: seaBattle,
  [colorRush.id]: colorRush,
  [dots.id]: dots,
  [five.id]: five,
  [territory.id]: territory,
  [gravity.id]: gravity,
  [codeBreaker.id]: codeBreaker,
  [memory.id]: memory,
};

export function getEngine(id: string): AnyEngine | undefined {
  return GAMES[id];
}
