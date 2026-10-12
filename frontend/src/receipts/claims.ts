import type { Call, ChannelReport, Evidence, HypeReport, Video } from "./api";
import type { MapMoment, MapStock, MapVideo } from "./evidenceData";

// One shape for "a moment where a stock was named", whether it came from a
// creator audit or a stock check -- the dashboard's right panel, network and
// charts all read this.

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface Claim {
  id: string;
  video: { id: string; title: string; url: string; date: string | null; channel: string | null; views?: number | null; length?: string | null };
  start_s: number;
  quote: string;
  quoteEn: string | null; // English translation, when the quote isn't in English
  direction: Call["direction"];
  sentiment: Sentiment;
  explicit: boolean;
  evidence: Evidence[];
  reason: string | null;
  context: { start_s: number; text: string }[];
  timestamp_url: string;
  target: number | null;
  stock: { key: string; name: string; gf: string | null; yahoo: string | null; heard?: string; correctedViaSearch?: boolean };
  ret: number | null; // 30 trading-day move after the claim
  mkt: number | null; // Nifty over the same window
  outcome: string | null;
  entry: { date: string; price: number } | null;
  exit: { date: string; price: number } | null; // the price 30 days later
  priceSource: string | null;
  windows: TimeWindow[]; // the same tip judged after 1 week, 1 month and 3 months
}

export interface TimeWindow {
  days: number;
  label: string;
  status: "done" | "pending" | "none";
  ret: number | null;
  mkt: number | null;
  right: boolean | null;
}

const WINDOWS: [number, string][] = [
  [7, "1 week"],
  [30, "1 month"],
  [90, "3 months"],
];

function windowsOf(c: Call): TimeWindow[] {
  return WINDOWS.map(([days, label]) => {
    const h = c.score?.horizons?.[String(days)];
    if (h?.status === "done")
      return { days, label, status: "done", ret: h.stock_return_pct ?? null, mkt: h.nifty_return_pct ?? null, right: h.right ?? null };
    return { days, label, status: h?.status === "pending" ? "pending" : "none", ret: null, mkt: null, right: null };
  });
}

export const sentimentOf = (d: string): Sentiment =>
  d === "buy" ? "bullish" : d === "sell" || d === "avoid" ? "bearish" : "neutral";

export const shortSymbol = (gf: string | null | undefined, name: string) => (gf ? gf.split(":")[0] : name.split(" ")[0].toUpperCase());

function videoOf(v: Video | undefined, c: Call) {
  return {
    id: c.video_id,
    title: c.video_title,
    url: c.video_url,
    date: c.call_date,
    channel: v?.channel ?? null,
    views: v?.views ?? null,
    length: v?.length ?? null,
  };
}

export function claimsFromChannel(r: ChannelReport): Claim[] {
  const byId = new Map(r.videos.map((v) => [v.video_id, v]));
  return r.calls.map((c, i) => {
    const h = c.score?.horizons?.["30"];
    return {
      id: `${c.video_id}-${c.start_s}-${i}`,
      video: videoOf(byId.get(c.video_id), c),
      start_s: c.start_s,
      quote: c.quote,
      quoteEn: c.quote_en ?? null,
      direction: c.direction,
      sentiment: sentimentOf(c.direction),
      explicit: c.explicit,
      evidence: c.evidence ?? [],
      reason: c.reason ?? null,
      context: c.context ?? [],
      timestamp_url: c.timestamp_url,
      target: c.target_price,
      stock: {
        key: c.ticker?.yahoo_symbol ?? `name:${c.company.toLowerCase()}`,
        name: c.ticker?.name ?? c.company,
        gf: c.ticker?.google_finance ?? null,
        yahoo: c.ticker?.yahoo_symbol ?? null,
        heard: c.ticker && c.ticker.name.toLowerCase() !== c.company.toLowerCase() ? c.company : undefined,
        correctedViaSearch: c.ticker?.resolved_via === "google_search",
      },
      ret: h?.status === "done" ? (h.stock_return_pct ?? null) : null,
      mkt: h?.status === "done" ? (h.nifty_return_pct ?? null) : null,
      outcome: c.score?.outcome ?? null,
      entry: c.score?.entry ? { date: c.score.entry.date, price: c.score.entry.price } : null,
      exit: h?.status === "done" && h.exit ? { date: h.exit.date, price: h.exit.price } : null,
      priceSource: c.price_source ?? null,
      windows: windowsOf(c),
    };
  });
}

export function claimsFromStock(r: HypeReport): Claim[] {
  const stock = {
    key: r.ticker?.yahoo_symbol ?? `name:${r.company.toLowerCase()}`,
    name: r.ticker?.name ?? r.company,
    gf: r.ticker?.google_finance ?? null,
    yahoo: r.ticker?.yahoo_symbol ?? null,
  };
  return r.videos.flatMap((v) =>
    (v.mentions ?? []).map((m, i) => ({
      id: `${v.video_id}-${m.start_s}-${i}`,
      video: { id: v.video_id, title: v.title, url: v.url, date: v.published_date, channel: v.channel, views: v.views ?? null, length: v.length ?? null },
      start_s: m.start_s,
      quote: m.quote,
      quoteEn: m.quote_en ?? null,
      direction: m.direction,
      sentiment: sentimentOf(m.direction),
      explicit: m.explicit,
      evidence: m.evidence ?? [],
      reason: m.reason ?? null,
      context: m.context ?? [],
      timestamp_url: m.timestamp_url,
      target: m.target_price,
      stock,
      ret: null,
      mkt: null,
      outcome: null,
      entry: null,
      exit: null,
      priceSource: null,
      windows: [],
    })),
  );
}

const VERDICT: Record<string, MapStock["verdict"]> = {
  beat_market: { label: "Better than the market", tone: "good" },
  lagged_market_as_called: { label: "Warning was right", tone: "good" },
  lagged_market: { label: "Worse than the market", tone: "bad" },
  beat_market_against_call: { label: "Warning was wrong", tone: "bad" },
  pending: { label: "Too new to judge", tone: "muted" },
};

// adapters for the reasoning trace component
export function traceArgs(c: Claim): { m: MapMoment; stock: MapStock; video: MapVideo } {
  return {
    m: {
      id: c.id,
      videoId: c.video.id,
      stockKey: c.stock.key,
      start_s: c.start_s,
      quote: c.quote,
      direction: c.direction,
      explicit: c.explicit,
      evidence: c.evidence,
      reason: c.reason,
      context: c.context,
      timestamp_url: c.timestamp_url,
      target: c.target,
    },
    stock: {
      key: c.stock.key,
      name: c.stock.name,
      symbol: c.stock.gf,
      heard: c.stock.heard,
      correctedViaSearch: c.stock.correctedViaSearch,
      ret: c.ret,
      mkt: c.mkt,
      verdict: c.direction === "watch" ? { label: "Passing mention", tone: "muted" } : c.outcome ? VERDICT[c.outcome] : undefined,
      entry: c.entry ? `₹${Number(c.entry.price.toFixed(2))} on ${c.entry.date}` : undefined,
    },
    video: { id: c.video.id, title: c.video.title, channel: c.video.channel, date: c.video.date, url: c.video.url },
  };
}

// group claims per stock: mention count, dominant sentiment, return
export interface StockAgg {
  key: string;
  name: string;
  gf: string | null;
  yahoo: string | null;
  mentions: number;
  sentiment: Sentiment;
  ret: number | null;
  firstDate: string | null;
  claims: Claim[];
}

export function byStock(claims: Claim[]): StockAgg[] {
  const m = new Map<string, StockAgg>();
  for (const c of claims) {
    const a = m.get(c.stock.key) ?? { key: c.stock.key, name: c.stock.name, gf: c.stock.gf, yahoo: c.stock.yahoo, mentions: 0, sentiment: "neutral" as Sentiment, ret: null, firstDate: null, claims: [] };
    a.mentions += 1;
    a.claims.push(c);
    if (c.ret != null && a.ret == null) a.ret = c.ret;
    if (c.video.date && (!a.firstDate || c.video.date < a.firstDate)) a.firstDate = c.video.date;
    m.set(c.stock.key, a);
  }
  for (const a of m.values()) {
    const score = a.claims.reduce((s, c) => s + (c.sentiment === "bullish" ? 1 : c.sentiment === "bearish" ? -1 : 0), 0);
    a.sentiment = score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral";
  }
  return [...m.values()].sort((x, y) => y.mentions - x.mentions);
}
