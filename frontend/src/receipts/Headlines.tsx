import { useEffect, useState } from "react";
import { SafeImg } from "./SafeImg";
import { receiptsApi, type NewsItem } from "./api";
import { cleanName } from "./format";

// Google News headlines (via SerpApi, saved for a week). Headlines and links
// only: Receipts never draws a conclusion from them.

const GENERIC = new Set(["india", "industries", "limited", "solutions", "technology", "energy", "bank", "port", "express", "share", "global", "and"]);

// keep headlines that actually name the company; fall back to all if that leaves too few
function relevant(items: NewsItem[], name?: string) {
  if (!name) return items;
  const words = cleanName(name).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
  if (!words.length) return items;
  const hits = items.filter((i) => words.some((w) => i.title.toLowerCase().includes(w)));
  return hits.length >= 2 ? hits : items;
}

const cache = new Map<string, Promise<NewsItem[]>>();
function load(q: string) {
  if (!cache.has(q)) cache.set(q, receiptsApi.news(q).then((r) => r.items).catch(() => []));
  return cache.get(q)!;
}

export interface NewsSource {
  query: string;
  label?: string; // shown as a tag when mixing several stocks
  match?: string; // company name for the relevance filter
}

function ago(date: string | null) {
  if (!date) return "";
  const t = Date.parse(date);
  if (Number.isNaN(t)) return date.split(",")[0];
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days < 1) return "today";
  if (days < 31) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Row = NewsItem & { tag?: string };

export function Headlines({ sources, fixed = [], perSource = 3, limit = 6, title = "In the news", hint }: { sources: NewsSource[]; fixed?: Row[]; perSource?: number; limit?: number; title?: string; hint?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const sig = sources.map((s) => s.query).join("|");

  useEffect(() => {
    let alive = true;
    Promise.all(sources.map((s) => load(s.query).then((items) => relevant(items, s.match).slice(0, perSource).map((i) => ({ ...i, tag: s.label })))))
      .then((lists) => {
        if (!alive) return;
        const seen = new Set<string>();
        const merged = [...fixed, ...lists.flat()].filter((r) => {
          const k = r.title.toLowerCase().slice(0, 60);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setRows(merged.slice(0, limit));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, fixed.length]);

  if (rows && !rows.length) return null;
  return (
    <section className="db-card hl">
      <div className="db-card-head">
        <h3>{title}</h3>
        <span className="db-hint">{hint ?? "Google News via SerpApi"}</span>
      </div>
      {rows === null ? (
        <p className="rc-muted">Loading headlines…</p>
      ) : (
        <ul className="hl-list">
          {rows.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">
                <span className="hl-body">
                  <small>
                    <SafeImg className="hl-icon" src={r.icon ?? undefined} alt="" width={16} height={16} fallback={<span className="hl-icon hl-icon-txt">{(r.source ?? "?").slice(0, 1)}</span>} />
                    <span className="hl-src">{r.source}</span>
                    {r.date && <span>· {ago(r.date)}</span>}
                    {r.tag && <i>{r.tag}</i>}
                  </small>
                  <b>{r.title}</b>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
