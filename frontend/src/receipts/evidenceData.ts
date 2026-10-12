import type { Call, ChannelReport, Evidence, HypeReport } from "./api";

// Turns a channel audit or a stock check into the three columns of the
// evidence map: videos -> moments -> stocks.

export interface MapVideo {
  id: string;
  title: string;
  channel?: string | null;
  date?: string | null;
  url: string;
}

export interface MapMoment {
  id: string;
  videoId: string;
  stockKey: string;
  alsoKeys?: string[]; // one sentence can name several stocks
  start_s: number;
  quote: string;
  direction: Call["direction"];
  explicit: boolean;
  evidence: Evidence[];
  reason?: string | null;
  context: { start_s: number; text: string }[];
  timestamp_url: string;
  target?: number | null;
}

export interface MapStock {
  key: string;
  name: string;
  symbol?: string | null;
  heard?: string; // what the captions actually said, when it differs
  correctedViaSearch?: boolean;
  ret?: number | null;
  mkt?: number | null;
  verdict?: { label: string; tone: "good" | "bad" | "muted" };
  entry?: string;
}

export interface MapData {
  videos: MapVideo[];
  moments: MapMoment[];
  stocks: MapStock[];
}

const VERDICT: Record<string, { label: string; tone: "good" | "bad" | "muted" }> = {
  beat_market: { label: "Beat the market", tone: "good" },
  lagged_market_as_called: { label: "Fell, as called", tone: "good" },
  lagged_market: { label: "Trailed the market", tone: "bad" },
  beat_market_against_call: { label: "Rose against the call", tone: "bad" },
  pending: { label: "Too recent", tone: "muted" },
  no_price_data: { label: "No price data", tone: "muted" },
};

const stockKeyOf = (c: { company: string; ticker?: { yahoo_symbol: string } | null }) =>
  c.ticker?.yahoo_symbol ?? `name:${c.company.toLowerCase()}`;

export function mapFromChannel(r: ChannelReport, includeWatch: boolean): MapData {
  const calls = r.calls.filter((c) => includeWatch || c.direction !== "watch");
  const videoIds = new Set(calls.map((c) => c.video_id));
  const videos = r.videos
    .filter((v) => videoIds.has(v.video_id))
    .map((v) => ({ id: v.video_id, title: v.title, channel: v.channel, date: v.published_date, url: v.url }));
  const stocks = new Map<string, MapStock>();
  const moments = calls.map((c, i) => {
    const key = stockKeyOf(c);
    if (!stocks.has(key)) {
      const h = c.score?.horizons?.["30"];
      stocks.set(key, {
        key,
        name: c.ticker?.name ?? c.company,
        symbol: c.ticker?.google_finance,
        heard: c.ticker && c.ticker.name.toLowerCase() !== c.company.toLowerCase() ? c.company : undefined,
        correctedViaSearch: c.ticker?.resolved_via === "google_search",
        ret: h?.status === "done" ? h.stock_return_pct : null,
        mkt: h?.status === "done" ? h.nifty_return_pct : null,
        verdict: c.direction === "watch" ? { label: "Passing mention", tone: "muted" } : VERDICT[c.score?.outcome ?? ""],
        entry: c.score?.entry ? `₹${Number(c.score.entry.price.toFixed(2))} on ${c.score.entry.date}` : undefined,
      });
    }
    return {
      id: `${c.video_id}-${c.start_s}-${i}`,
      videoId: c.video_id,
      stockKey: key,
      start_s: c.start_s,
      quote: c.quote,
      direction: c.direction,
      explicit: c.explicit,
      evidence: c.evidence ?? [],
      reason: c.reason,
      context: c.context ?? [],
      timestamp_url: c.timestamp_url,
      target: c.target_price,
    };
  });
  return { videos, moments, stocks: [...stocks.values()] };
}

export function mapFromStock(r: HypeReport): MapData {
  const key = r.ticker?.yahoo_symbol ?? `name:${r.company.toLowerCase()}`;
  const mapped = r.videos.filter((v) => v.mentions && v.mentions.length > 0);
  const moments = mapped.flatMap((v) =>
    (v.mentions ?? []).map((m, i) => ({
      id: `${v.video_id}-${m.start_s}-${i}`,
      videoId: v.video_id,
      stockKey: key,
      start_s: m.start_s,
      quote: m.quote,
      direction: m.direction,
      explicit: m.explicit,
      evidence: m.evidence ?? [],
      reason: m.reason,
      context: m.context ?? [],
      timestamp_url: m.timestamp_url,
      target: m.target_price,
    })),
  );
  return {
    videos: mapped.map((v) => ({ id: v.video_id, title: v.title, channel: v.channel, date: v.published_date, url: v.url })),
    moments,
    stocks: [
      {
        key,
        name: r.ticker?.name ?? r.company,
        symbol: r.ticker?.google_finance,
        verdict:
          r.pump_check?.level === "full_pattern"
            ? { label: "Pump-and-dump pattern", tone: "bad" }
            : r.pump_check?.level === "pump_in_progress"
              ? { label: "Spiked, no crash yet", tone: "bad" }
              : r.pump_check
                ? { label: "No pump pattern", tone: "muted" }
                : undefined,
      },
    ],
  };
}

// From the dashboard's claims: one moment per (video, timestamp, quote), so a
// sentence naming two stocks is one card with two lines, not two cards.
export function mapFromClaims(claims: import("./claims").Claim[]): MapData {
  const moments: MapMoment[] = [];
  const byKey = new Map<string, MapMoment>();
  const stocks = new Map<string, MapStock>();
  const videos = new Map<string, MapVideo>();
  for (const c of claims) {
    videos.set(c.video.id, { id: c.video.id, title: c.video.title, channel: c.video.channel, date: c.video.date, url: c.video.url });
    if (!stocks.has(c.stock.key)) {
      stocks.set(c.stock.key, {
        key: c.stock.key,
        name: c.stock.name,
        symbol: c.stock.gf,
        ret: c.ret,
        mkt: c.mkt,
        verdict: c.direction === "watch" ? { label: "Passing mention", tone: "muted" } : VERDICT[c.outcome ?? ""],
      });
    }
    const k = `${c.video.id}|${c.start_s}|${c.quote}`;
    const existing = byKey.get(k);
    if (existing) {
      if (existing.stockKey !== c.stock.key && !existing.alsoKeys?.includes(c.stock.key)) existing.alsoKeys = [...(existing.alsoKeys ?? []), c.stock.key];
      continue;
    }
    const m: MapMoment = {
      id: c.id, videoId: c.video.id, stockKey: c.stock.key, start_s: c.start_s, quote: c.quote, direction: c.direction,
      explicit: c.explicit, evidence: c.evidence, reason: c.reason, context: c.context, timestamp_url: c.timestamp_url, target: c.target,
    };
    byKey.set(k, m);
    moments.push(m);
  }
  return { videos: [...videos.values()], moments, stocks: [...stocks.values()] };
}
