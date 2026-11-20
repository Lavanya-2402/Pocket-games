/**
 * The app icon: an indigo rounded tile with a coral cross and a teal ring.
 * Drawn with plain boxes so it needs no fonts or image files.
 * `maskable` adds the safe margin Android wants for adaptive icons.
 */
export function AppIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const pad = maskable ? 0 : size * 0.06;
  const tile = size - pad * 2;
  const mark = tile * (maskable ? 0.26 : 0.32);
  const stroke = Math.max(2, mark * 0.26);
  const bar = (deg: number) => ({
    position: "absolute" as const,
    left: mark / 2 - stroke / 2,
    top: -mark * 0.1,
    width: stroke,
    height: mark * 1.2,
    background: "#ff7a5c",
    borderRadius: stroke,
    transform: `rotate(${deg}deg)`,
  });
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: tile, height: tile, borderRadius: maskable ? 0 : tile * 0.24, background: "#23256b",
          display: "flex", alignItems: "center", justifyContent: "center", gap: tile * 0.09,
        }}
      >
        <div style={{ width: mark, height: mark, display: "flex", position: "relative" }}>
          <div style={bar(45)} />
          <div style={bar(-45)} />
        </div>
        <div style={{ width: mark, height: mark, borderRadius: mark, border: `${stroke}px solid #4fc7bd`, display: "flex" }} />
      </div>
    </div>
  );
}
