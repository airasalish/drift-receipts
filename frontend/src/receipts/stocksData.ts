import { useEffect, useMemo, useState } from "react";
import { receiptsApi, type WatchRow } from "./api";
import type { Claim } from "./claims";
import { shortName, useCreators } from "./data";
import { isSebiCaseStock } from "./hooks";
import { VERDICT } from "./plain";

// One row per stock we know about: named in an audited creator's video, or
// checked directly. Prices come from one free Yahoo request for the lot.

export interface StockRow {
  key: string; // lowercase short name
  name: string;
  query: string; // what the stock page loads
  gf: string | null;
  yahoo: string | null;
  tips: Claim[];
  creators: string[];
  last: string | null;
  scored: number;
  beat: number;
  avgRet: number | null;
  videos: number; // videos found by a direct stock check
}

export const yahooFromGf = (gf?: string | null) => {
  if (!gf) return null;
  const [sym, ex] = gf.split(":");
  return ex === "NSE" ? `${sym}.NS` : ex === "BOM" ? `${sym}.BO` : null;
};

export function useStockIndex() {
  const { creators, stocks } = useCreators();
  const rows = useMemo(() => {
    if (!creators) return null;
    const map = new Map<string, StockRow>();
    const get = (name: string, query: string, gf: string | null, yahoo: string | null) => {
      const key = shortName(name).toLowerCase();
      let r = map.get(key);
      if (!r) {
        r = { key, name: shortName(name), query, gf, yahoo, tips: [], creators: [], last: null, scored: 0, beat: 0, avgRet: null, videos: 0 };
        map.set(key, r);
      }
      r.gf ??= gf;
      r.yahoo ??= yahoo;
      return r;
    };
    for (const c of creators)
      for (const t of c.tips) {
        const r = get(t.stock.name, shortName(t.stock.name), t.stock.gf, t.stock.yahoo);
        r.tips.push(t);
        if (!r.creators.includes(c.name)) r.creators.push(c.name);
        if ((t.video.date ?? "") > (r.last ?? "")) r.last = t.video.date;
      }
    for (const s of stocks) {
      if (isSebiCaseStock(s.query)) continue;
      const r = get(s.label, s.query, s.ticker, yahooFromGf(s.ticker));
      r.query = s.query; // the saved stock check is keyed by this
      r.videos = s.videos;
    }
    for (const r of map.values()) {
      const graded = r.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]);
      r.scored = graded.length;
      r.beat = graded.filter((t) => VERDICT[t.outcome!].good).length;
      r.avgRet = graded.length ? graded.reduce((n, t) => n + (t.ret ?? 0), 0) / graded.length : null;
      r.yahoo ??= yahooFromGf(r.gf);
    }
    // Indian listings first; stocks we couldn't match to NSE/BSE (US picks) go last
    return [...map.values()].sort((a, b) => Number(!a.gf) - Number(!b.gf) || b.tips.length - a.tips.length || b.videos - a.videos || a.name.localeCompare(b.name));
  }, [creators, stocks]);
  return rows;
}

export function useQuotes(symbols: string[]) {
  const [rows, setRows] = useState<Record<string, WatchRow>>({});
  const sig = symbols.join(",");
  useEffect(() => {
    if (!sig) return;
    let alive = true;
    receiptsApi
      .watch(sig.split(","))
      .then((r) => alive && setRows(Object.fromEntries(r.rows.map((x) => [x.symbol, x]))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sig]);
  return rows;
}

