import { describe, expect, it } from "vitest";
import { carry, checkers, legalMoves as checkerMoves, type CheckersState, type Piece } from "./checkers";
import { chess, legalMoves, type ChessState } from "./chess";
import { goFish, rankOf, type GoFishState } from "./gofish";
import { count, flips, legal, reversi, type Cell } from "./reversi";
import { rps, TARGET } from "./rps";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("Chess", () => {
  /** Set up a position from the usual one-line notation (FEN). */
  function fen(text: string): ChessState {
    const [rows, turn, castle, ep] = text.split(" ");
    const board = [...rows.replace(/\//g, "")].flatMap((ch) => (/\d/.test(ch) ? Array(Number(ch)).fill(null) : [ch]));
    const sq = ep === "-" ? null : (8 - Number(ep[1])) * 8 + ep.charCodeAt(0) - 97;
    return { ...chess.init([A, B], 0), board, turn: turn === "w" ? 0 : 1, castle: castle === "-" ? "" : castle, ep: sq };
  }
  /** Count every line of play to a given depth — the standard way to prove move generation is right. */
  function perft(s: ChessState, depth: number): number {
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(chess.apply(s, m, s.players[s.turn]), depth - 1);
    return n;
  }

  it("finds exactly the right number of moves from the start", () => {
    const s = chess.init([A, B], 0);
    expect(perft(s, 1)).toBe(20);
    expect(perft(s, 2)).toBe(400);
    expect(perft(s, 3)).toBe(8902);
    expect(perft(s, 4)).toBe(197281);
  }, 60_000);

  it("gets castling, pins and captures right", () => {
    const s = fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -");
    expect(perft(s, 1)).toBe(48);
    expect(perft(s, 2)).toBe(2039);
    expect(perft(s, 3)).toBe(97862);
  }, 60_000);

  it("gets en passant and its pins right", () => {
    const s = fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -");
    expect(perft(s, 1)).toBe(14);
    expect(perft(s, 2)).toBe(191);
    expect(perft(s, 3)).toBe(2812);
    expect(perft(s, 4)).toBe(43238);
  }, 60_000);

  it("gets promotion right", () => {
    const s = fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -");
    expect(perft(s, 1)).toBe(6);
    expect(perft(s, 2)).toBe(264);
    expect(perft(s, 3)).toBe(9467);
  }, 60_000);

  it("ends on checkmate, and calls stalemate a draw", () => {
    // Fool's mate.
    let s = chess.init([A, B], 0);
    const sq = (name: string) => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      s = chess.apply(s, { from: sq(from), to: sq(to) }, s.players[s.turn]);
    }
    expect(s.end).toBe("mate");
    expect(s.winner).toBe(B);

    let t = fen("7k/5Q2/8/8/8/8/8/K7 w - -");
    t = chess.apply(t, { from: sq("f7"), to: sq("g6") }, A); // black king has no move, and isn't in check
    expect(t.end).toBe("stalemate");
    expect(t.winner).toBe("draw");
  });

  it("won't let you leave or put your king in check, and promotes to a queen by default", () => {
    const sq = (name: string) => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
    const pinned = fen("4r2k/8/8/8/8/8/4R3/4K3 w - -");
    expect(chess.validate(pinned, { from: sq("e2"), to: sq("d2") }, A)).toBeTruthy(); // the rook is pinned
    expect(chess.validate(pinned, { from: sq("e2"), to: sq("e5") }, A)).toBeNull();
    const promo = chess.apply(fen("7k/P7/8/8/8/8/8/K7 w - -"), { from: sq("a7"), to: sq("a8") }, A);
    expect(promo.board[sq("a8")]).toBe("Q");
    const bare = chess.apply(fen("7k/8/8/8/8/8/p7/1K6 w - -"), { from: sq("b1"), to: sq("a2") }, A);
    expect(bare.end).toBe("material");
  });
});

describe("Reversi", () => {
  it("starts with four discs and four legal moves", () => {
    const s = reversi.init([A, B], 0);
    expect(count(s.board)).toEqual([2, 2]);
    expect(legal(s.board, 0)).toHaveLength(4);
  });

  it("flips every trapped line, in all directions", () => {
    const b: Cell[] = Array(64).fill(null);
    // Row 0: mine, theirs, theirs, (empty) ; column 3 below the empty square: theirs, mine.
    b[0] = 0; b[1] = 1; b[2] = 1; b[11] = 1; b[19] = 0;
    expect(flips(b, 3, 0).sort((x, y) => x - y)).toEqual([1, 2, 11]);
    expect(flips(b, 3, 1)).toEqual([]);
  });

  it("skips a player who can't move, and ends when neither can", () => {
    const b: Cell[] = Array(64).fill(null);
    b[0] = 0; b[1] = 1; // only move on the board: seat 0 at square 2
    const s = reversi.apply({ players: [A, B], board: b, turn: 0, last: null, winner: null }, { cell: 2 }, A);
    expect(s.winner).toBe(A);
    expect(count(s.board)).toEqual([3, 0]);
  });
});

describe("Checkers", () => {
  const empty = (): Piece[] => Array(64).fill(null);
  const at = (board: Piece[], turn: 0 | 1 = 0): CheckersState => ({ players: [A, B], board, turn, quiet: 0, last: null, winner: null });

  it("starts with twelve pieces each on dark squares, seven opening moves", () => {
    const s = checkers.init([A, B], 0);
    expect(s.board.filter((p) => p === 0)).toHaveLength(12);
    expect(s.board.filter((p) => p === 2)).toHaveLength(12);
    expect(checkerMoves(s.board, 0)).toHaveLength(7);
  });

  it("forces a capture and makes you finish a double jump", () => {
    const b = empty();
    b[5 * 8 + 2] = 0; // my man
    b[4 * 8 + 3] = 2; // their man, with an empty square behind
    b[2 * 8 + 5] = 2; // and another to jump next
    b[7 * 8 + 0] = 0; // a second man of mine that could otherwise just step
    const moves = checkerMoves(b, 0);
    expect(moves).toEqual([{ from: 42, path: [28, 14] }]);
    expect(checkers.validate(at(b), { from: 42, path: [28] }, A)).toBeTruthy();
    expect(checkers.validate(at(b), { from: 56, path: [49] }, A)).toBeTruthy();
    const after = carry(b, moves[0]);
    expect(after.taken.sort((x, y) => x - y)).toEqual([21, 35]);
    expect(after.board.filter((p) => p === 2)).toHaveLength(0);
  });

  it("crowns a man on the far row, and kings move backwards", () => {
    const b = empty();
    b[1 * 8 + 2] = 0;
    b[7 * 8 + 6] = 2;
    const s = checkers.apply(at(b), { from: 10, path: [1] }, A);
    expect(s.board[1]).toBe(1);
    expect(s.last!.crowned).toBe(true);
    expect(checkerMoves(s.board, 0).some((m) => m.from === 1 && m.path[0] > 8)).toBe(true);
  });

  it("wins when the other side has nothing left", () => {
    const b = empty();
    b[5 * 8 + 2] = 0;
    b[4 * 8 + 3] = 2;
    const s = checkers.apply(at(b), { from: 42, path: [28] }, A);
    expect(s.winner).toBe(A);
  });
});

describe("Go Fish", () => {
  const card = (rank: number, suit: number) => suit * 13 + rank;
  const at = (hands: number[][], deck: number[] = []): GoFishState =>
    ({ players: [A, B, C].slice(0, hands.length), hands, deck, sets: hands.map(() => []), known: hands.map(() => []), turn: 0, last: null, winner: null });

  it("deals seven each to two or three players and five each to four", () => {
    expect(goFish.init([A, B], 1).hands.map((h) => h.length)).toEqual([7, 7]);
    expect(goFish.init([A, B, C, "d"], 1).hands[3]).toHaveLength(5);
  });

  it("hands over every card of the rank and lets you ask again", () => {
    const s = goFish.apply(at([[card(4, 0), card(9, 0)], [card(4, 1), card(4, 2), card(2, 0)]], [card(7, 0)]), { from: 1, rank: 4 }, A);
    expect(s.hands[0].filter((c) => rankOf(c) === 4)).toHaveLength(3);
    expect(s.hands[1]).toEqual([card(2, 0)]);
    expect(s.turn).toBe(0);
    expect(s.last!.got).toBe(2);
  });

  it("goes fishing when they have none, and lays down a set of four", () => {
    let s = at([[card(4, 0), card(9, 0)], [card(2, 0)]], [card(1, 0), card(7, 0)]);
    expect(goFish.validate(s, { from: 1, rank: 5 }, A)).toBeTruthy(); // must hold the rank
    expect(goFish.validate(s, { from: 0, rank: 4 }, A)).toBeTruthy(); // can't ask yourself
    s = goFish.apply(s, { from: 1, rank: 4 }, A);
    expect(s.hands[0]).toHaveLength(3);
    expect(s.deck).toHaveLength(1);
    expect(s.turn).toBe(1);
    const four = goFish.apply(at([[card(6, 0), card(6, 1), card(6, 2), card(3, 3)], [card(6, 3), card(3, 0)]], [card(8, 0)]), { from: 1, rank: 6 }, A);
    expect(four.sets[0]).toEqual([6]);
    expect(four.hands[0]).toEqual([card(3, 3)]);
  });

  it("never shows anyone else's cards", () => {
    const s = goFish.init([A, B, C], 5);
    const v = JSON.stringify(goFish.viewFor(s, A));
    expect(v).not.toContain(JSON.stringify(s.hands[1]));
    expect(v).not.toContain(JSON.stringify(s.deck));
  });
});

describe("Rock Paper Scissors", () => {
  it("hides a pick until both are in, then scores the round", () => {
    let s = rps.init([A, B], 0);
    s = rps.apply(s, { pick: "rock" }, A);
    expect((rps.viewFor(s, B) as { pending: unknown[] }).pending).toEqual(["hidden", null]);
    expect(rps.validate(s, { pick: "paper" }, A)).toBeTruthy();
    s = rps.apply(s, { pick: "scissors" }, B);
    expect(s.wins).toEqual([1, 0]);
    expect(s.last).toEqual({ throws: ["rock", "scissors"], winner: 0 });
  });

  it("replays a tie and ends at the target", () => {
    let s = rps.init([A, B], 0);
    s = rps.apply(rps.apply(s, { pick: "paper" }, B), { pick: "paper" }, A);
    expect(s.wins).toEqual([0, 0]);
    for (let i = 0; i < TARGET; i++) s = rps.apply(rps.apply(s, { pick: "paper" }, B), { pick: "rock" }, A);
    expect(s.winner).toBe(B);
  });
});
