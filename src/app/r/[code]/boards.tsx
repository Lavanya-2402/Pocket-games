"use client";

import type { ReactNode } from "react";
import type { SeaBattleView } from "@/games/seabattle";
import { BidTacToeBoard } from "./bidtactoe-board";
import { ColorRushBoard } from "./colorrush-board";
import { Connect4Board } from "./connect4-board";
import { DotsBoard } from "./dots-board";
import { DuelBoard } from "./duel-board";
import { FiveBoard } from "./five-board";
import { SeaBattleBoard } from "./seabattle-board";
import { TicTacToeBoard } from "./tictactoe-board";

/** What every game board receives. Seats are game seats (index into state.players). */
export interface BoardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each board knows its own state shape
  state: any;
  /** The viewer's game seat, or null for spectators. */
  mySeat: 0 | 1 | null;
  /** Player names by game seat. */
  names: [string, string];
  /** Game seats in room-seat order, so positions and colours stay put across rematches. */
  layout: [number, number];
  /** Turn-based games: it is the viewer's turn. */
  myTurn: boolean;
  onMove: (move: unknown) => void;
}

export interface GameUI {
  Board: (p: BoardProps) => ReactNode;
  /** Sizing class for the board area (see globals.css). */
  fit: string;
  /** The board draws its own player cards, so the room hides the generic ones. */
  ownCards?: boolean;
  /** Piece shown on a player's card, by game seat. */
  mark?: (seat: 0 | 1) => string;
  /** Status line for phases that aren't plain "your turn"; null = use the default. */
  status?: (state: BoardProps["state"], mySeat: 0 | 1 | null) => string | null;
  /** "turn" by default, e.g. "shot". */
  turnWord?: string;
}

const WIDE = "mx-auto w-full lg:max-w-lg";

const lockIn = (verb: string) => (s: { pending: unknown[]; round: number }, me: 0 | 1 | null) =>
  me === null ? `Round ${s.round}: choosing…` : s.pending[me] ? "Locked in" : `Round ${s.round}: ${verb}`;

export const GAME_UI: Record<string, GameUI> = {
  tictactoe: {
    Board: (p) => <TicTacToeBoard state={p.state} canMove={p.myTurn} onMove={(cell) => p.onMove({ cell })} />,
    fit: "fit-square",
    mark: (s) => (s === 0 ? "✕" : "◯"),
  },
  connect4: {
    Board: (p) => <Connect4Board state={p.state} canMove={p.myTurn} onMove={(col) => p.onMove({ col })} />,
    fit: "fit-square",
    mark: () => "●",
  },
  bidtactoe: {
    Board: (p) => (
      <BidTacToeBoard state={p.state} mySeat={p.mySeat} names={p.names} layout={p.layout} onBid={(bid, cell) => p.onMove({ bid, cell })} />
    ),
    fit: WIDE,
    ownCards: true,
    status: lockIn("place your bid"),
  },
  duel: {
    Board: (p) => (
      <DuelBoard state={p.state} mySeat={p.mySeat} names={p.names} layout={p.layout} onAct={(action) => p.onMove({ action })} />
    ),
    fit: WIDE,
    ownCards: true,
    status: lockIn("pick your move"),
  },
  seabattle: {
    Board: (p) => <SeaBattleBoard state={p.state} mySeat={p.mySeat} names={p.names} layout={p.layout} onMove={p.onMove} />,
    fit: "w-full",
    turnWord: "shot",
    status: (s: SeaBattleView, me) =>
      s.phase !== "place" ? null : me === null ? "Placing ships…" : s.ready[me] ? "Ships ready" : "Place your ships",
  },
  dots: { Board: DotsBoard, fit: "fit-tall", mark: () => "■" },
  five: { Board: FiveBoard, fit: "fit-square", mark: () => "●" },
  colorrush: {
    Board: (p) => <ColorRushBoard state={p.state} mySeat={p.mySeat} names={p.names} layout={p.layout} onMove={p.onMove} />,
    fit: WIDE,
  },
};
