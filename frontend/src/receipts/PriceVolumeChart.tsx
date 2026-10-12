import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "./api";

export interface Marker {
  date: string;
  label: string;
}

// a labelled dot on the price line, e.g. "③ Highest point"
export interface Note {
  date: string;
  label: string;
  tone?: "green" | "red" | "amber";
}

const NOTE_COLOR = { green: "#7fd1a0", red: "#e5675f", amber: "#d9a441" };

const fmtVol = (v: number) =>
  v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`;

// Price line over volume bars, with the promotion dates drawn as vertical
// markers -- the whole pump-and-dump argument in one picture: quiet volume,
// videos land, volume and price explode, then the price falls back.
export function PriceVolumeChart({
  points,
  markers = [],
  notes = [],
  from,
  to,
  highlight,
  height = 320,
}: {
  points: PricePoint[];
  markers?: Marker[];
  notes?: Note[];
  from?: string;
  to?: string;
  highlight?: [string, string];
  height?: number;
}) {
  // one point per date: a repeated date breaks the category axis, and with it
  // every marker and note pinned to a date
  const byDate = new Map<string, { date: string; price: number; volume: number }>();
  for (const p of points) if ((!from || p.date >= from) && (!to || p.date <= to)) byDate.set(p.date, { date: p.date, price: p.price, volume: p.volume ?? 0 });
  const data = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (data.length < 2) return <p className="rc-muted">Not enough price history to chart.</p>;

  // markers must sit on an x value that exists in the data (category axis)
  const snap = (d: string) => data.find((p) => p.date >= d)?.date;

  return (
    <div className="rc-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1e2224" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#8b9092", fontSize: 11 }} minTickGap={48} tickLine={false} axisLine={{ stroke: "#303437" }} />
          <YAxis yAxisId="price" orientation="right" tick={{ fill: "#c5c8c9", fontSize: 11 }} tickFormatter={(v) => `₹${v}`} width={52} axisLine={false} tickLine={false} />
          <YAxis yAxisId="vol" orientation="left" tick={{ fill: "#62686a", fontSize: 10 }} tickFormatter={fmtVol} width={46} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#111314", border: "1px solid #303437", borderRadius: 4, fontSize: 12 }}
            labelStyle={{ color: "#c5c8c9" }}
            formatter={(value, name) => (name === "volume" ? [fmtVol(Number(value)), "Volume"] : [`₹${value}`, "Price"])}
          />
          {highlight && snap(highlight[0]) && snap(highlight[1]) && (
            <ReferenceArea yAxisId="price" x1={snap(highlight[0])} x2={snap(highlight[1])} fill="#f44747" fillOpacity={0.06} />
          )}
          <Bar yAxisId="vol" dataKey="volume" fill="#2a2e31" isAnimationActive={false} />
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#7fd1a0" strokeWidth={2} dot={false} isAnimationActive={false} />
          {markers.map((m, i) => {
            const x = snap(m.date);
            return x ? (
              <ReferenceLine
                key={`${m.date}-${i}`}
                yAxisId="price"
                x={x}
                stroke="#d9a441"
                strokeDasharray="4 3"
                // numbered notes already say what the lines mean
                label={i === 0 && notes.length === 0 ? { value: m.label, fill: "#d9a441", fontSize: 11, position: "insideTopLeft" } : undefined}
              />
            ) : null;
          })}
          {notes.map((n) => {
            const p = data.find((d) => d.date >= n.date);
            const c = NOTE_COLOR[n.tone ?? "amber"];
            return p ? (
              <ReferenceDot
                key={n.label}
                yAxisId="price"
                x={p.date}
                y={p.price}
                r={6}
                fill={c}
                stroke="#000"
                strokeWidth={2}
                label={{ value: n.label, position: "top", fill: c, fontSize: 13, fontWeight: 700, offset: 10 }}
              />
            ) : null;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
