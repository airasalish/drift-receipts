import { useEffect, useMemo, useState } from "react";
import { receiptsApi, type NewsItem } from "./api";
import { ChevronRight, External } from "./Icons";
import { SafeImg } from "./SafeImg";

// A slim, rotating strip of real enforcement headlines (Google News via
// SerpApi, saved for the public site). Headlines and links only.

const QUERIES = ["stock market tips fraud arrested India", "finfluencer arrested"];
// keep stories about action taken on investment fraud; drop off-topic hits
const KEEP = /\b(arrest|arrested|arrests|held|busted|bust|bans|banned|sentenced|prison|jail|crackdown|manipulation|freeze|frozen)\b/i;
const TOPIC = /\b(fraud|scam|stock|trading|investment|invest|finfluencers?|ponzi|manipulation|sebi|tips?)\b/i;
const DROP = /\b(harassment|edition|how to|tax)\b/i;

function ago(date: string | null) {
  if (!date) return "";
  const t = Date.parse(date);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days < 1) return "today";
  if (days < 31) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function NewsStrip() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all(QUERIES.map((q) => receiptsApi.news(q).then((r) => r.items).catch(() => [] as NewsItem[]))).then((lists) => {
      if (!alive) return;
      const seen = new Set<string>();
      setItems(
        lists
          .flat()
          .filter((n) => KEEP.test(n.title) && TOPIC.test(n.title) && !DROP.test(n.title))
          .filter((n) => {
            const k = n.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 30);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    if (!items?.length || paused || reduced) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5500);
    return () => clearInterval(t);
  }, [items, paused, reduced]);

  if (!items?.length) return null;
  const n = items[i % items.length];
  return (
    <section className="ns" aria-label="Enforcement headlines" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="ns-tag">
        <span className="ns-pulse" aria-hidden="true" />
        In the news
      </span>
      <a key={n.url} className="ns-item" href={n.url} target="_blank" rel="noreferrer" aria-live="polite">
        <SafeImg className="ns-icon" src={n.icon ?? undefined} alt="" width={16} height={16} fallback={<span className="ns-icon ns-icon-txt">{(n.source ?? "?").slice(0, 1)}</span>} />
        <b>{n.title}</b>
        <small>
          {n.source}
          {n.date ? ` · ${ago(n.date)}` : ""}
        </small>
        <External size={13} />
      </a>
      <span className="ns-nav">
        <small>
          {(i % items.length) + 1}/{items.length}
        </small>
        <button onClick={() => setI((x) => (x - 1 + items.length) % items.length)} aria-label="Previous headline">
          <ChevronRight size={15} className="flip" />
        </button>
        <button onClick={() => setI((x) => (x + 1) % items.length)} aria-label="Next headline">
          <ChevronRight size={15} />
        </button>
      </span>
    </section>
  );
}
