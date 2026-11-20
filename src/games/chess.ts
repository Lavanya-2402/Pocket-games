import { z } from "zod";
import type { GameEngine, Outcome, Players } from "./types";
import { pick } from "./util";

/**
 * Chess, with all the usual rules: castling, en passant, promotion, check, checkmate,
 * stalemate, the fifty-move rule and draws when neither side has enough left to mate.
 *
 * Squares are numbered 0-63 from the top-left (a8) to the bottom-right (h1). Pieces are
 * letters: capitals for White (the first player, who starts at the bottom), small
 * letters for Black.
 */

type Seat = 0 | 1;
export type Square = string | null;
export type Promo = "q" | "r" | "b" | "n";
export interface ChessMove { from: number; to: number; promo?: Promo }
/** Plies (single moves) before a game is called a draw, so no game goes on for ever. */
export const MAX_PLIES = 300;

/** The bare position: enough to work out what is legal. */
export interface Pos {
  board: Square[];
  turn: Seat;
  /** Castling still allowed: K/Q for White's king and queen side, k/q for Black's. */
  castle: string;
  /** Square a pawn just skipped over (where it can be taken en passant), if any. */
  ep: number | null;
}

export interface ChessState extends Pos {
  players: Players;
  half: number; // plies since a capture or pawn move (fifty-move rule)
  plies: number;
  check: boolean; // the player to move is in check
  last: { by: Seat; from: number; to: number; piece: string; took: string | null; castled: boolean } | null;
  end: null | "mate" | "stalemate" | "fifty" | "material" | "length";
  winner: Outcome;
}

export const ownerOf = (p: string): Seat => (p < "a" ? 0 : 1);
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ok = (r: number, c: number) => r >= 0 && c >= 0 && r < 8 && c < 8;

/** Is this square attacked by any piece of `by`? */
export function attacked(b: readonly Square[], sq: number, by: Seat): boolean {
  const r = sq >> 3, c = sq & 7;
  const pr = by === 0 ? r + 1 : r - 1; // a pawn attacks diagonally forward
  const pawn = by === 0 ? "P" : "p";
  if (pr >= 0 && pr < 8 && ((c > 0 && b[pr * 8 + c - 1] === pawn) || (c < 7 && b[pr * 8 + c + 1] === pawn))) return true;
  const knight = by === 0 ? "N" : "n", king = by === 0 ? "K" : "k";
  for (const [dr, dc] of KNIGHT) if (ok(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === knight) return true;
  for (const [dr, dc] of KING) if (ok(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === king) return true;
  const diag = by === 0 ? "BQ" : "bq", orth = by === 0 ? "RQ" : "rq";
  for (const [dirs, who] of [[DIAG, diag], [ORTH, orth]] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (ok(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) {
          if (who.includes(p)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

const kingOf = (b: readonly Square[], seat: Seat) => b.indexOf(seat === 0 ? "K" : "k");
export const inCheck = (pos: Pos, seat: Seat) => attacked(pos.board, kingOf(pos.board, seat), (1 - seat) as Seat);

/** Every move the pieces could make, before checking whether it leaves the king in check. */
function pseudo(pos: Pos): ChessMove[] {
  const b = pos.board;
  const me = pos.turn;
  const them = (1 - me) as Seat;
  const out: ChessMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || ownerOf(p) !== me) continue;
    const r = i >> 3, c = i & 7;
    const t = p.toLowerCase();
    if (t === "p") {
      const dir = me === 0 ? -8 : 8;
      const lastRow = me === 0 ? 0 : 7;
      const add = (to: number) => {
        if (to >> 3 === lastRow) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from: i, to, promo });
        else out.push({ from: i, to });
      };
      const one = i + dir;
      if (!b[one]) {
        add(one);
        if (r === (me === 0 ? 6 : 1) && !b[one + dir]) out.push({ from: i, to: one + dir });
      }
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const to = one + dc;
        const q = b[to];
        if ((q && ownerOf(q) !== me) || to === pos.ep) add(to);
      }
      continue;
    }
    if (t === "n" || t === "k") {
      for (const [dr, dc] of t === "n" ? KNIGHT : KING) {
        if (!ok(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        const q = b[to];
        if (!q || ownerOf(q) !== me) out.push({ from: i, to });
      }
      // Castling: king and rook unmoved, nothing between them, and the king doesn't pass through check.
      const home = me === 0 ? 60 : 4;
      if (t === "k" && i === home && !attacked(b, home, them)) {
        const rook = me === 0 ? "R" : "r";
        if (pos.castle.includes(me === 0 ? "K" : "k") && !b[home + 1] && !b[home + 2] && b[home + 3] === rook
          && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) out.push({ from: home, to: home + 2 });
        if (pos.castle.includes(me === 0 ? "Q" : "q") && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook
          && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) out.push({ from: home, to: home - 2 });
      }
      continue;
    }
    for (const [dr, dc] of t === "b" ? DIAG : t === "r" ? ORTH : KING) {
      let rr = r + dr, cc = c + dc;
      while (ok(rr, cc)) {
        const to = rr * 8 + cc;
        const q = b[to];
        if (!q) out.push({ from: i, to });
        else {
          if (ownerOf(q) !== me) out.push({ from: i, to });
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return out;
}

interface Undo { piece: string; took: Square; tookAt: number; castle: string; ep: number | null; rook: [number, number] | null }

/** Make a move on the position itself. Returns what is needed to take it back. */
function play(pos: Pos, m: ChessMove): Undo {
  const b = pos.board;
  const me = pos.turn;
  const piece = b[m.from]!;
  const t = piece.toLowerCase();
  const undo: Undo = { piece, took: b[m.to], tookAt: m.to, castle: pos.castle, ep: pos.ep, rook: null };
  if (t === "p" && m.to === pos.ep) {
    undo.tookAt = m.to + (me === 0 ? 8 : -8);
    undo.took = b[undo.tookAt];
    b[undo.tookAt] = null;
  }
  b[m.to] = m.promo ? (me === 0 ? m.promo.toUpperCase() : m.promo) : piece;
  b[m.from] = null;
  if (t === "k" && Math.abs(m.to - m.from) === 2) {
    const from = m.to > m.from ? m.from + 3 : m.from - 4;
    const to = m.to > m.from ? m.from + 1 : m.from - 1;
    b[to] = b[from];
    b[from] = null;
    undo.rook = [from, to];
  }
  pos.ep = t === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  let cs = pos.castle;
  if (t === "k") cs = cs.replace(me === 0 ? /[KQ]/g : /[kq]/g, "");
  for (const sq of [m.from, m.to]) {
    if (sq === 63) cs = cs.replace("K", "");
    else if (sq === 56) cs = cs.replace("Q", "");
    else if (sq === 7) cs = cs.replace("k", "");
    else if (sq === 0) cs = cs.replace("q", "");
  }
  pos.castle = cs;
  pos.turn = (1 - me) as Seat;
  return undo;
}

function unplay(pos: Pos, m: ChessMove, u: Undo) {
  const b = pos.board;
  pos.turn = (1 - pos.turn) as Seat;
  b[m.from] = u.piece;
  b[m.to] = null;
  if (u.took) b[u.tookAt] = u.took;
  if (u.rook) {
    b[u.rook[0]] = b[u.rook[1]];
    b[u.rook[1]] = null;
  }
  pos.castle = u.castle;
  pos.ep = u.ep;
}

/** Legal moves for the player to move. The position is left exactly as it was. */
export function legalMoves(at: Pos): ChessMove[] {
  const pos: Pos = { board: [...at.board], turn: at.turn, castle: at.castle, ep: at.ep };
  const me = pos.turn;
  return pseudo(pos).filter((m) => {
    const u = play(pos, m);
    const safe = !inCheck(pos, me);
    unplay(pos, m, u);
    return safe;
  });
}

/** Neither side can possibly checkmate: bare kings, or a king and one bishop or knight against a king. */
function tooFew(b: readonly Square[]) {
  const rest = b.filter((p) => p && p.toLowerCase() !== "k") as string[];
  return rest.length === 0 || (rest.length === 1 && "bn".includes(rest[0].toLowerCase()));
}

// ---- the computer ----

const WORTH: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Material, plus a little for pieces near the middle and pawns far up the board. For the player to move. */
function evaluate(pos: Pos) {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const t = p.toLowerCase();
    const seat = ownerOf(p);
    const r = i >> 3, c = i & 7;
    let w = WORTH[t];
    if (t === "p") w += (seat === 0 ? 6 - r : r - 1) * 6;
    else if (t !== "k" && t !== "r") w += (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5))) * 5;
    v += seat === pos.turn ? w : -w;
  }
  return v;
}

function negamax(pos: Pos, depth: number, alpha: number, beta: number): number {
  const me = pos.turn;
  const b = pos.board;
  const moves = pseudo(pos).sort((x, y) => WORTH[b[y.to]?.toLowerCase() ?? "k"] - WORTH[b[x.to]?.toLowerCase() ?? "k"]);
  let best = -Infinity;
  for (const m of moves) {
    const u = play(pos, m);
    if (inCheck(pos, me)) {
      unplay(pos, m, u);
      continue;
    }
    const v = depth <= 1 ? -evaluate(pos) : -negamax(pos, depth - 1, -beta, -alpha);
    unplay(pos, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  // No legal move: checkmate (the sooner the worse) or stalemate.
  if (best === -Infinity) return inCheck(pos, me) ? -100000 - depth : 0;
  return best;
}

const START = "rnbqkbnrpppppppp" + " ".repeat(32) + "PPPPPPPPRNBQKBNR";

export const chess: GameEngine<ChessState, ChessMove> = {
  id: "chess",
  name: "Chess",
  moveSchema: z.object({
    from: z.number().int().min(0).max(63),
    to: z.number().int().min(0).max(63),
    promo: z.enum(["q", "r", "b", "n"]).optional(),
  }),

  init(players) {
    return {
      players, board: [...START].map((ch) => (ch === " " ? null : ch)), turn: 0, castle: "KQkq", ep: null,
      half: 0, plies: 0, check: false, last: null, end: null, winner: null,
    };
  },

  validate(s, m, playerId) {
    if (s.winner) return "Game is over";
    const seat = s.players.indexOf(playerId);
    if (seat === -1) return "You are not a player in this game";
    if (seat !== s.turn) return "Not your turn";
    const piece = s.board[m.from];
    if (!piece || ownerOf(piece) !== seat) return "Pick one of your own pieces";
    const found = legalMoves(s).some((x) => x.from === m.from && x.to === m.to && (x.promo ?? null) === (x.promo ? m.promo ?? "q" : null));
    if (found) return null;
    return s.check ? "You are in check — you must get out of it" : "That piece can't move there";
  },

  apply(s, m) {
    const me = s.turn;
    const pos: Pos = { board: [...s.board], turn: s.turn, castle: s.castle, ep: s.ep };
    const piece = pos.board[m.from]!;
    const isPawn = piece.toLowerCase() === "p";
    const promotes = isPawn && m.to >> 3 === (me === 0 ? 0 : 7);
    const move: ChessMove = { from: m.from, to: m.to, ...(promotes ? { promo: m.promo ?? "q" } : {}) };
    const u = play(pos, move);
    const half = isPawn || u.took ? 0 : s.half + 1;
    const plies = s.plies + 1;
    const check = inCheck(pos, pos.turn);
    const stuck = legalMoves(pos).length === 0;
    let end: ChessState["end"] = null;
    if (stuck) end = check ? "mate" : "stalemate";
    else if (tooFew(pos.board)) end = "material";
    else if (half >= 100) end = "fifty";
    else if (plies >= MAX_PLIES) end = "length";
    return {
      ...s, ...pos, half, plies, check, end,
      turn: end ? me : pos.turn,
      winner: end === "mate" ? s.players[me] : end ? "draw" : null,
      last: { by: me, from: m.from, to: m.to, piece, took: u.took, castled: u.rook !== null },
    };
  },

  winner: (s) => s.winner,
  turn: (s) => (s.winner ? null : s.players[s.turn]),
  timeLimit: () => 90,

  autoMove: (s, _p, rng) => pick(legalMoves(s), rng),

  botMove(s, _p, rng, level) {
    const moves = legalMoves(s);
    if (level === "easy" && rng() < 0.3) return pick(moves, rng);
    const depth = level === "hard" ? 3 : 2;
    const pos: Pos = { board: [...s.board], turn: s.turn, castle: s.castle, ep: s.ep };
    let best: ChessMove[] = [], bestV = -Infinity;
    for (const m of moves) {
      const u = play(pos, m);
      // A small random nudge so it doesn't play the same game every time.
      const v = (depth <= 1 ? -evaluate(pos) : -negamax(pos, depth - 1, -Infinity, Infinity)) + Math.floor(rng() * 8);
      unplay(pos, m, u);
      if (v > bestV) [best, bestV] = [[m], v];
      else if (v === bestV) best.push(m);
    }
    return pick(best, rng);
  },

  viewFor: (s) => s,
};
