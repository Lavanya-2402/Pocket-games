/** A colour for each seat, taken from the current skin. Four seats, four colours. */
const COLORS = ["var(--x)", "var(--o)", "var(--gold)", "var(--violet)"];
export const seatColor = (seat: number) => COLORS[seat % COLORS.length];

/** Grid columns for a row of per-player score cards. */
export const scoreCols = (n: number) => ({ gridTemplateColumns: `repeat(${Math.min(n, 4)}, minmax(0, 1fr))` });
