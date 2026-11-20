import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Dots and Boxes: take turns drawing a line between two neighbouring dots.
 * Close the fourth side of a box and it's yours — and you go again. Most boxes wins.
 */

export const N = 5; // boxes per side (so N+1 dots per side); 25 boxes means no ties
type Seat = 0 | 1;

export interface DotsState {
  players: Players;
  /** h[r][c]: line on top of box (r,c); r runs 0..N. Value = who drew it. */
  h: (Seat | null)[][];
  /** v[r][c]: line on the left of box (r,c); c runs 0..N. */
  v: (Seat | null)[][];
  /** Box owners. */
  boxes: (Seat | null)[][];
  turn: Seat;
  last: { o: "h" | "v"; r: number; c: number; by: Seat; closed: number } | null;
  winner: Outcome;
}

export type DotsMove = { o: "h" | "v"; r: number; c: number };

const inRange = (m: DotsMove) =>
  m.o === "h" ? m.r >= 0 && m.r <= N && m.c >= 0 && m.c < N : m.r >= 0 && m.r < N && m.c >= 0 && m.c <= N;

/** Sides already drawn around box (r,c). */
export function sides(s: Pick<DotsState, "h" | "v">, r: number, c: number) {
  return [s.h[r][c], s.h[r + 1][c], s.v[r][c], s.v[r][c + 1]].filter((x) => x !== null).length;
}

/** The (up to two) boxes that touch a line. */
function touching(m: DotsMove): [number, number][] {
  const list: [number, number][] = m.o === "h" ? [[m.r - 1, m.c], [m.r, m.c]] : [[m.r, m.c - 1], [m.r, m.c]];
  return list.filter(([r, c]) => r >= 0 && r < N && c >= 0 && c < N);
}

export function openLines(s: Pick<DotsState, "h" | "v">): DotsMove[] {
  const out: DotsMove[] = [];
  for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) if (s.h[r][c] === null) out.push({ o: "h", r, c });
  for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) if (s.v[r][c] === null) out.push({ o: "v", r, c });
  return out;
}

export const score = (s: Pick<DotsState, "boxes">) =>
  [0, 1].map((seat) => s.boxes.flat().filter((b) => b === seat).length) as [number, number];

export const dots: GameEngine<DotsState, DotsMove> = {
  id: "dots",
  name: "Dots and Boxes",
  moveSchema: z.object({ o: z.enum(["h", "v"]), r: z.number().int(), c: z.number().int() }),

  init(players) {
    return {
      players,
      h: Array.from({ length: N + 1 }, () => Array(N).fill(null)),
      v: Array.from({ length: N }, () => Array(N + 1).fill(null)),
      boxes: Array.from({ length: N }, () => Array(N).fill(null)),
      turn: 0,
      last: null,
      winner: null,
    };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    if (!inRange(m)) return "That line is off the board";
    if ((m.o === "h" ? s.h : s.v)[m.r][m.c] !== null) return "That line is already drawn";
    return null;
  },

  apply(s, m) {
    const h = s.h.map((row) => [...row]);
    const v = s.v.map((row) => [...row]);
    (m.o === "h" ? h : v)[m.r][m.c] = s.turn;
    const boxes = s.boxes.map((row) => [...row]);
    let closed = 0;
    for (const [r, c] of touching(m)) {
      if (boxes[r][c] === null && sides({ h, v }, r, c) === 4) {
        boxes[r][c] = s.turn;
        closed++;
      }
    }
    const [a, b] = score({ boxes });
    const winner: Outcome = a + b === N * N ? (a === b ? "draw" : s.players[a > b ? 0 : 1]) : null;
    return {
      ...s, h, v, boxes, winner,
      turn: closed > 0 ? s.turn : ((1 - s.turn) as Seat), // closing a box earns another go
      last: { ...m, by: s.turn, closed },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  viewFor: (s) => s,
  timeLimit: () => 20,

  autoMove(s, _p, rng) {
    return dots.botMove!(s, _p, rng, "easy");
  },

  // Take a box when one is on offer; otherwise avoid handing one over (a third side).
  botMove(s, _p, rng, level) {
    const lines = openLines(s);
    const closes = lines.filter((m) => touching(m).some(([r, c]) => sides(s, r, c) === 3));
    if (closes.length && (level === "hard" || rng() < 0.7)) return pick(closes, rng);
    const safe = lines.filter((m) => touching(m).every(([r, c]) => sides(s, r, c) < 2));
    if (safe.length && (level === "hard" || rng() < 0.6)) return pick(safe, rng);
    if (level === "hard" && !safe.length) {
      // Everything gives something away: give away as little as possible.
      const cost = (m: DotsMove) => touching(m).filter(([r, c]) => sides(s, r, c) === 2).length;
      const least = Math.min(...lines.map(cost));
      return pick(lines.filter((m) => cost(m) === least), rng);
    }
    return pick(lines, rng);
  },
};
