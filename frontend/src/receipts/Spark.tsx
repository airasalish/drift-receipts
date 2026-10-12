import type { PricePoint } from "./api";

// Tiny price line for cards and watchlist rows. Colour follows the move
// over the shown period; an optional marker shows a mention date.
export function Spark({ points, mark, width = 120, height = 36 }: { points: PricePoint[]; mark?: string | null; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const ys = points.map((p) => p.price);
  const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i: number) => (i / (points.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  const mi = mark ? points.findIndex((p) => p.date >= mark) : -1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden="true">
      <path d={`${d} L${x(points.length - 1)},${height} L${x(0)},${height} Z`} className={up ? "spark-fill-up" : "spark-fill-down"} />
      <path d={d} className={up ? "spark-up" : "spark-down"} />
      {mi >= 0 && <circle cx={x(mi)} cy={y(points[mi].price)} r="2.8" className="spark-mark" />}
    </svg>
  );
}
