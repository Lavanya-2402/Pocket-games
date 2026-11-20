"use client";

import { corners, HOME, movable, SAFE, type LudoView } from "@/games/ludo";
import type { BoardProps } from "./boards";
import { Die } from "./dice";
import { seatColor } from "./seat";

// The board is a 15 × 15 grid. Squares are [row, column].
type RC = [number, number];
const run = (r: number, c: number, dr: number, dc: number, n: number): RC[] => Array.from({ length: n }, (_, i) => [r + dr * i, c + dc * i]);
/** The 52 shared squares, clockwise, starting at the top-left player's start square. */
const PATH: RC[] = [
  ...run(6, 1, 0, 1, 5), ...run(5, 6, -1, 0, 6), [0, 7], ...run(0, 8, 1, 0, 6), ...run(6, 9, 0, 1, 6), [7, 14],
  ...run(8, 14, 0, -1, 6), ...run(9, 8, 1, 0, 6), [14, 7], ...run(14, 6, -1, 0, 6), ...run(8, 5, 0, -1, 6), [7, 0], [6, 0],
];
/** Per corner: the five home-column squares, then the home square itself. */
const HOME_RUN: RC[][] = [
  [...run(7, 1, 0, 1, 5), [7, 6]],
  [...run(1, 7, 1, 0, 5), [6, 7]],
  [...run(7, 13, 0, -1, 5), [7, 8]],
  [...run(13, 7, -1, 0, 5), [8, 7]],
];
/** Top-left square of each corner's yard. */
const YARD: RC[] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const YARD_SPOTS: RC[] = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]];

/** Centre of the square a piece stands on, as [x, y]. */
function spot(corner: number, progress: number, piece: number): [number, number] {
  let rc: RC;
  if (progress === -1) rc = [YARD[corner][0] + YARD_SPOTS[piece][0], YARD[corner][1] + YARD_SPOTS[piece][1]];
  else if (progress <= 50) rc = PATH[(corner * 13 + progress) % PATH.length];
  else rc = HOME_RUN[corner][progress - 51];
  return [rc[1] + 0.5, rc[0] + 0.5];
}

/** Ludo: the classic cross-shaped race board. */
export function LudoBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as LudoView;
  const n = s.players.length;
  const corner = corners(n);
  const seatAt = (q: number) => corner.indexOf(q); // -1 = empty corner
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const options = myTurn && s.roll !== null && mySeat !== null ? movable(s, mySeat, s.roll) : [];
  const last = s.last;

  // Pieces sharing a square are fanned out so each can be seen.
  const all = s.pieces.flatMap((row, seat) => row.map((p, piece) => ({ seat, piece, p, at: spot(corner[seat], p, piece) })));
  const crowd = new Map<string, number>();
  const drawn = all.map((t) => {
    const key = t.at.join(",");
    const k = crowd.get(key) ?? 0;
    crowd.set(key, k + 1);
    return { ...t, k };
  });

  return (
    <div className="flex flex-col gap-2.5">
      <svg viewBox="0 0 15 15" className="w-full touch-manipulation rounded-2xl bg-surface" role="group" aria-label="Ludo board">
        {/* Yards */}
        {YARD.map(([r, c], q) => {
          const seat = seatAt(q);
          const col = seat >= 0 ? seatColor(seat) : "var(--line)";
          return (
            <g key={q}>
              <rect x={c + 0.25} y={r + 0.25} width={5.5} height={5.5} rx={0.9} fill={col} opacity={seat >= 0 ? 0.28 : 0.4} />
              {seat >= 0 && YARD_SPOTS.slice(0, s.pieces[seat].length).map(([dr, dc], i) => (
                <circle key={i} cx={c + dc + 0.5} cy={r + dr + 0.5} r={0.62} fill="var(--surface)" />
              ))}
            </g>
          );
        })}
        {/* Shared track */}
        {PATH.map(([r, c], i) => {
          const start = i % 13 === 0 ? seatAt(i / 13) : -1;
          return (
            <g key={i}>
              <rect
                x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.16}
                fill={start >= 0 ? seatColor(start) : "var(--bg)"} fillOpacity={start >= 0 ? 0.55 : 1}
                stroke="var(--line)" strokeWidth={0.04}
              />
              {SAFE.includes(i) && i % 13 !== 0 && (
                <text x={c + 0.5} y={r + 0.72} textAnchor="middle" fontSize={0.6} fill="var(--muted)">★</text>
              )}
            </g>
          );
        })}
        {/* Home columns and the home square */}
        {HOME_RUN.map((cells, q) => cells.map(([r, c], i) => {
          const seat = seatAt(q);
          return (
            <rect
              key={`${q}-${i}`} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.16}
              fill={seat >= 0 ? seatColor(seat) : "var(--line)"} fillOpacity={i === 5 ? 0.9 : 0.4}
            />
          );
        }))}
        <text x={7.5} y={7.78} textAnchor="middle" fontSize={0.8}>🏠</text>

        {/* Pieces */}
        {drawn.map((t) => {
          const many = (crowd.get(t.at.join(",")) ?? 1) > 1;
          const dx = many ? ((t.k % 2) - 0.5) * 0.36 : 0;
          const dy = many ? (Math.floor(t.k / 2) - 0.5) * 0.36 : 0;
          const canMove = t.seat === mySeat && options.includes(t.piece);
          const isLast = last?.by === t.seat && last.piece === t.piece;
          return (
            <g key={`${t.seat}-${t.piece}`} style={{ transform: `translate(${t.at[0] + dx}px, ${t.at[1] + dy}px)`, transition: "transform 350ms ease-out" }}>
              {canMove && <circle r={0.62} fill="none" stroke="var(--ink)" strokeWidth={0.1} strokeDasharray="0.2 0.14" />}
              <circle r={many ? 0.3 : 0.38} fill={seatColor(t.seat)} stroke="#fff" strokeWidth={isLast ? 0.14 : 0.08} opacity={t.p === HOME ? 0.85 : 1} />
              {canMove && (
                <circle
                  r={0.95} fill="transparent" className="cursor-pointer" role="button"
                  aria-label={`Move your piece ${t.piece + 1}`}
                  onClick={() => onMove({ type: "move", piece: t.piece })}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-2.5">
        <span key={`${last?.by}-${last?.roll}-${last?.piece}-${last?.to}-${s.roll}`} className="pop"><Die face={s.roll ?? last?.roll ?? null} size={46} /></span>
        <p className="min-w-0 flex-1 text-sm">
          {options.length > 0 ? <b>You rolled {s.roll}. Tap a piece to move it.</b>
            : !last ? "Roll a 6 to bring a piece out. First to get every piece home wins."
            : <>
                <b>{who(last.by)}</b> rolled {last.roll}
                {last.note === "three" ? " — three sixes in a row, turn lost"
                  : last.note === "stuck" ? " — no piece can move"
                  : last.hit?.length ? <> and <b className="text-x">sent {last.hit.map(who).join(" and ")} back</b></>
                  : last.to === HOME ? <> and <b className="text-o">brought a piece home</b></>
                  : last.from === -1 ? " and brought a piece out"
                  : ""}
              </>}
        </p>
        {myTurn && s.roll === null && (
          <button type="button" onClick={() => onMove({ type: "roll" })} className="chunk h-12 shrink-0 rounded-2xl bg-accent px-5 font-semibold text-accent-ink">
            Roll
          </button>
        )}
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
        {layout.map((seat) => (
          <span key={seat} className="flex items-center gap-1">
            <span className="size-3 rounded-full" style={{ background: seatColor(seat) }} />
            {who(seat)} · {s.pieces[seat].filter((p) => p === HOME).length}/{s.pieces[seat].length} home
          </span>
        ))}
      </p>
    </div>
  );
}
