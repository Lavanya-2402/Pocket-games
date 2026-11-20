import { bidTacToe } from "./bidtactoe";
import { codeBreaker } from "./codebreaker";
import { colorRush } from "./colorrush";
import { connect4 } from "./connect4";
import { dots } from "./dots";
import { duel } from "./duel";
import { five } from "./five";
import { gravity } from "./gravity";
import { liarsDice } from "./liarsdice";
import { memory } from "./memory";
import { minefield } from "./minefield";
import { seaBattle } from "./seabattle";
import { territory } from "./territory";
import { ticTacToe } from "./tictactoe";
import { yacht } from "./yacht";
import { greedy } from "./greedy";
import { ludo } from "./ludo";
import { climb } from "./climb";
import { tileMatch } from "./tilematch";
import { dominoes } from "./dominoes";
import { mancala } from "./mancala";
import { matchsticks } from "./matchsticks";
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
  [minefield.id]: minefield,
  [liarsDice.id]: liarsDice,
  [yacht.id]: yacht,
  [greedy.id]: greedy,
  [ludo.id]: ludo,
  [climb.id]: climb,
  [tileMatch.id]: tileMatch,
  [dominoes.id]: dominoes,
  [mancala.id]: mancala,
  [matchsticks.id]: matchsticks,
};

export function getEngine(id: string): AnyEngine | undefined {
  return GAMES[id];
}
