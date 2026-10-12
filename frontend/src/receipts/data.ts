import { useEffect, useState } from "react";
import { receiptsApi, type ChannelReport, type Profile } from "./api";
import { claimsFromChannel, type Claim } from "./claims";
import { useExamples } from "./hooks";
import { VERDICT } from "./plain";

// Everything the creator grid and creator page need, loaded once per creator.

export interface CreatorSummary {
  query: string;
  name: string;
  profile: Profile | null;
  report: ChannelReport;
  tips: Claim[]; // buy/sell/avoid calls, newest first
  scored: number;
  beat: number;
  made: number;
}

const cache = new Map<string, Promise<CreatorSummary | null>>();

export function loadCreator(query: string): Promise<CreatorSummary | null> {
  if (!cache.has(query)) {
    cache.set(
      query,
      Promise.all([receiptsApi.channel(query), receiptsApi.profile(query).then((r) => r.profile).catch(() => null)])
        .then(([report, profile]) => summarize(query, report, profile))
        .catch(() => null),
    );
  }
  return cache.get(query)!;
}

export function summarize(query: string, report: ChannelReport, profile: Profile | null): CreatorSummary {
  const tips = claimsFromChannel(report)
    .filter((c) => c.direction !== "watch" && c.direction !== "hold")
    .sort((a, b) => (b.video.date ?? "").localeCompare(a.video.date ?? "") || a.start_s - b.start_s);
  const graded = tips.filter((c) => c.outcome && VERDICT[c.outcome] && c.ret != null);
  return {
    query,
    name: cleanTitle(profile?.title ?? report.channel),
    profile,
    report,
    tips,
    scored: graded.length,
    beat: graded.filter((c) => VERDICT[c.outcome!].good).length,
    made: graded.filter((c) => (c.ret ?? 0) > 0).length,
  };
}

export function useCreator(query: string | null) {
  const [state, setState] = useState<{ q: string | null; data: CreatorSummary | null; done: boolean }>({ q: null, data: null, done: false });
  useEffect(() => {
    if (!query) return;
    let alive = true;
    loadCreator(query).then((d) => alive && setState({ q: query, data: d, done: true }));
    return () => {
      alive = false;
    };
  }, [query]);
  return state.q === query ? state : { q: query, data: null, done: false };
}

export function useCreators() {
  const examples = useExamples();
  const [list, setList] = useState<CreatorSummary[] | null>(null);
  const sig = (examples?.channels ?? []).map((c) => c.query).join("|");
  useEffect(() => {
    if (!sig) return;
    let alive = true;
    Promise.all(sig.split("|").map(loadCreator)).then((xs) => {
      if (alive) setList(xs.filter((x): x is CreatorSummary => !!x && x.tips.length > 0).sort((a, b) => b.scored - a.scored || b.tips.length - a.tips.length));
    });
    return () => {
      alive = false;
    };
  }, [sig]);
  return { creators: list, stocks: examples?.stocks ?? [] };
}

export const creatorPath = (q: string) => `/receipts/c/${encodeURIComponent(q)}`;
export const stockPath = (q: string) => `/receipts/s/${encodeURIComponent(q)}`;

export const fmtSubs = (n?: number | null) =>
  n == null ? "" : n >= 1e7 ? `${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} lakh` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;

export const shortName = (n: string) => n.replace(/\s+(Limited|Ltd\.?)$/, "");

export function useTitle(title: string | null) {
  useEffect(() => {
    if (title) document.title = `${title} · Receipts`;
  }, [title]);
}

// "Pushkar Raj Thakur: Stock Market Educator 📈" -> "Pushkar Raj Thakur"
export const cleanTitle = (t: string) =>
  t
    .split(/\s[:|–—-]\s|:\s|\|/)[0]
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .trim() || t;

// Lower bound of the 95% Wilson interval for a win rate: ranks 9 of 17 above
// 2 of 3, because a big sample is stronger evidence than a lucky small one.
export function wilsonLower(wins: number, n: number, z = 1.96): number {
  if (!n) return 0;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
}
