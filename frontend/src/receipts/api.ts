// Receipts API client. Public routes -- no auth header needed.
// On Vercel, Receipts is served same-origin (VITE_RECEIPTS_API_BASE set to
// empty) while the rest of Watchlist still talks to its own backend.
const ROOT = import.meta.env.VITE_RECEIPTS_API_BASE ?? import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";
const BASE = `${ROOT}/api/receipts`;

export interface PricePoint {
  date: string;
  price: number;
  volume?: number | null;
}

export interface Ticker {
  yahoo_symbol: string;
  google_finance: string | null;
  name: string;
  exchange: string;
  resolved_via?: string;
  search_query?: string;
}

export interface HorizonResult {
  status: "done" | "pending" | "no_price_data";
  exit?: PricePoint;
  stock_return_pct?: number;
  nifty_return_pct?: number | null;
  excess_vs_nifty_pct?: number | null;
  right?: boolean | null;
}

export interface PumpRule {
  rule: "illiquid" | "volume_spike" | "price_runup" | "collapse";
  label: string;
  detail: string;
}

export interface PumpCheck {
  status: "ok" | "insufficient_data";
  level?: "full_pattern" | "pump_in_progress" | "partial" | "none";
  fired: PumpRule[];
  metrics: Record<string, number | string | null>;
  promotion_date_used?: string;
}

export interface Call {
  company: string;
  direction: "buy" | "sell" | "hold" | "avoid" | "watch";
  explicit: boolean;
  target_price: number | null;
  stop_loss: number | null;
  horizon: string | null;
  quote: string;
  quote_en?: string; // display-only English translation of a non-English quote
  line: string;
  start_s: number;
  ticker: Ticker | null;
  evidence?: Evidence[];
  reason?: string | null;
  context?: { start_s: number; text: string }[];
  video_id: string;
  video_title: string;
  video_url: string;
  timestamp_url: string;
  call_date: string | null;
  date_uncertainty_days: number;
  price_source?: string;
  score?: {
    entry?: PricePoint | null;
    horizons: Record<string, HorizonResult>;
    target_hit?: boolean | null;
    outcome: string;
  };
  pump_check?: PumpCheck;
}

export interface TierStats {
  calls: number;
  scored_30d: number;
  pending: number;
  beat_nifty_30d: number;
  hit_rate_30d_pct: number | null;
  avg_excess_vs_nifty_30d_pct: number | null;
  median_excess_vs_nifty_30d_pct: number | null;
}

export interface Video {
  video_id: string;
  title: string;
  url: string;
  channel: string;
  published_date: string | null;
  published_text: string;
  date_uncertainty_days: number;
  transcript_status?: string;
  thumbnail?: string | null;
  views?: number | null;
  mentions?: Mention[] | null;
  length?: string | null;
  extraction?: { rejected_unverified: number; chunks: number; llm_failed_chunks: number };
}

export interface ChannelReport {
  channel: string;
  channel_url: string | null;
  status: string;
  videos: Video[];
  calls: Call[];
  report_card?: {
    explicit: TierStats;
    featured_picks: TierStats;
    all_scoreable: TierStats;
    targets_set: number;
    targets_hit: number;
    unresolved_companies: string[];
    watch_mentions: number;
  };
  regulatory?: {
    checked: boolean;
    sebi_pages: { title: string; url: string; snippet?: string }[];
    news: { title: string; url: string; source?: string; date?: string }[];
    reason?: string;
  };
  notes: string[];
  credits_used?: number;
  generated_at?: string;
  live?: boolean; // produced by an on-demand live check
  suggestions?: string[]; // channel names YouTube returned, when the name didn't match
}

export interface SeriesOut {
  source: string;
  symbol: string;
  window: string | null;
  name?: string | null;
  points: PricePoint[];
  stale?: boolean;
}

export interface CaseStudy {
  case: {
    company: string;
    google_finance: string;
    order_title: string;
    order_date: string;
    order_url: string;
    investigation_period: [string, string];
    video_uploads: { date: string; channel: string }[];
    order_findings: string[];
  };
  series: SeriesOut;
  pump_check: PumpCheck;
  yahoo_has_data: boolean;
}

export interface HypeReport {
  company: string;
  ticker: Ticker | null;
  videos: Video[];
  pump_check: PumpCheck | null;
  series: SeriesOut | null;
  generated_at?: string;
}

export interface Profile {
  title: string;
  handle?: string | null;
  subscribers?: number | null;
  thumbnail?: string | null;
  link?: string | null;
  verified?: boolean | null;
  description?: string | null;
}

export interface WatchMention {
  channel: string | null;
  video_title: string;
  video_id: string;
  date: string | null;
  direction: string;
  quote: string;
  timestamp_url: string;
  outcome: string | null;
}

export interface UnusualSignal {
  rule: string;
  tone: "up" | "down" | "warn";
  message: string;
}

export interface WatchRow {
  symbol: string;
  price: number | null;
  change_pct: number | null;
  points: PricePoint[];
  mentions: WatchMention[];
  signals: UnusualSignal[];
  stats: { week52_high: number; week52_low: number; avg_daily_move_pct: number; volume: number; avg_volume_20d: number | null } | null;
}

export interface ChartData {
  symbol: string;
  range: string;
  dates: string[];
  closes: number[];
  opens: (number | null)[] | null;
  highs: (number | null)[] | null;
  lows: (number | null)[] | null;
  volumes: (number | null)[] | null;
  currency: string | null;
}

export interface Examples {
  channels: { query: string; label: string; videos: number; picks: number }[];
  stocks: { query: string; label: string; ticker: string | null; videos: number }[];
}

export interface Evidence {
  text: string;
  where: "title" | "transcript";
  start_s?: number;
}

export interface Mention {
  direction: Call["direction"];
  explicit: boolean;
  target_price: number | null;
  quote: string;
  quote_en?: string;
  start_s: number;
  line: string;
  evidence?: Evidence[];
  reason?: string | null;
  timestamp_url: string;
  context?: { start_s: number; text: string }[];
}

export interface LiveFeed {
  nifty: { price: number; change: number; change_pct: number; as_of: string; source: string } | null;
  tape: {
    kind: "pump" | "tip";
    stock: string;
    text?: string;
    change_pct: number;
    market_pct?: number | null;
    verdict: string;
    good: boolean;
    date: string | null;
  }[];
}

export interface Budget {
  app: { month: string; used: number; budget: number; remaining: number };
  serpapi_account: { plan_name: string; searches_per_month: number; this_month_usage: number; total_searches_left: number } | null;
  offline: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// 404 from Receipts means "the public demo has no saved result for this".
export const isDemoMiss = (e: unknown) => e instanceof ApiError && e.status === 404;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || `request failed (${res.status})`, res.status);
  }
  return res.json();
}

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  icon?: string | null;
  date: string | null;
  thumbnail?: string | null;
}

export interface LiveStatus {
  enabled: boolean;
  local_only?: boolean;
  reason?: string;
  searches_per_check?: number;
  searches_left?: number | null;
}

export interface SerpSource {
  file: string;
  engine: string;
  engine_label: string;
  label: string;
  why: string;
  params: Record<string, string>;
  search_id: string | null;
  created_at: string | null;
}

export const rawSerpUrl = (file: string) => `${BASE}/raw/${encodeURIComponent(file)}`;

export interface FirstLook {
  available: boolean;
  known?: boolean;
  channel?: string | null;
  about?: string | null;
  category?: string;
  gives_stock_tips?: "often" | "sometimes" | "never" | "unknown";
  confidence?: number;
  skip_search?: boolean;
}

export const receiptsApi = {
  firstLook: (name: string) => get<FirstLook>(`/first-look?name=${encodeURIComponent(name)}`),
  sources: (video: string, gf: string | null, channel: string | null) =>
    get<{ sources: SerpSource[] }>(`/sources?${new URLSearchParams({ video, ...(gf ? { gf } : {}), ...(channel ? { channel } : {}) })}`),
  liveStatus: () => get<LiveStatus>("/live-status"),
  liveCheck: (name: string) => get<ChannelReport>(`/live-check?name=${encodeURIComponent(name)}`),
  news: (q: string) => get<{ query: string; items: NewsItem[]; checked: boolean }>(`/news?q=${encodeURIComponent(q)}`),
  channel: (name: string, maxVideos = 4) =>
    get<ChannelReport>(`/channel?name=${encodeURIComponent(name)}&max_videos=${maxVideos}`),
  hype: (company: string) => get<HypeReport>(`/hype?company=${encodeURIComponent(company)}`),
  sebiCase: () => get<CaseStudy>("/case/sebi-sadhna"),
  budget: () => get<Budget>("/budget"),
  live: () => get<LiveFeed>("/live"),
  examples: () => get<Examples>("/examples"),
  profile: (name: string) => get<{ profile: Profile | null }>(`/profile?name=${encodeURIComponent(name)}`),
  transcript: (v: string) => get<{ video_id: string; segments: { start_s: number; text: string }[] }>(`/transcript?v=${encodeURIComponent(v)}`),
  series: (gf?: string | null, yahoo?: string | null) =>
    get<{ source: string; symbol: string; window: string | null; points: PricePoint[] }>(
      `/series?${new URLSearchParams({ ...(gf ? { gf } : {}), ...(yahoo ? { yahoo } : {}) })}`,
    ),
  watch: (symbols: string[]) => get<{ rows: WatchRow[] }>(`/watch?symbols=${encodeURIComponent(symbols.join(","))}`),
  chart: (symbol: string, range: string) => get<ChartData>(`/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`),
  lookup: (q: string) => get<{ results: Ticker[] }>(`/lookup?q=${encodeURIComponent(q)}`),
};
