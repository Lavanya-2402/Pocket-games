import { scoreCols, seatColor } from "./seat";

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

/** One die, drawn with pips so it looks the same on every phone. No face = a hidden die. */
export function Die({ face, size = 44, lit = false, dim = false }: { face: number | null; size?: number; lit?: boolean; dim?: boolean }) {
  return (
    <span
      role="img"
      aria-label={face ? `Die showing ${face}` : "Hidden die"}
      className={`grid shrink-0 grid-cols-3 grid-rows-3 rounded-[22%] border-2 transition
        ${face ? "bg-white" : "bg-accent"} ${lit ? "border-x" : "border-ink/15"} ${dim ? "opacity-35" : ""}`}
      style={{ width: size, height: size, padding: Math.round(size * 0.13) }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`m-auto size-[70%] rounded-full ${face && PIPS[face].includes(i) ? "bg-[#1b1c4b]" : ""}`} />
      ))}
    </span>
  );
}

/** A row of score cards, one per player, in a fixed order. The player to move is outlined. */
export function ScoreStrip({
  layout, scores, who, turn = null, note,
}: {
  layout: number[];
  scores: (number | string)[];
  who: (seat: number) => string;
  /** Game seat of the player to move, if any. */
  turn?: number | null;
  /** Small text after each name, e.g. "of 75". */
  note?: string;
}) {
  return (
    <div className="grid gap-2 text-center" style={scoreCols(layout.length)}>
      {layout.map((seat) => (
        <div key={seat} className={`min-w-0 rounded-2xl border bg-surface px-1 py-1.5 ${turn === seat ? "border-ink" : "border-transparent"}`}>
          <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: seatColor(seat) }}>{scores[seat]}</span>
          <span className="ml-1.5 text-xs text-muted">{who(seat)}{note && layout.length === 2 ? ` · ${note}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
