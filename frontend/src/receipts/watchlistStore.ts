import { useCallback, useEffect, useState } from "react";
import { LIST_TEMPLATES } from "./templates";

// Watchlists live in the visitor's browser: no account needed, nothing
// shared. Storage access is wrapped because it can throw (private mode).

export interface WatchStock {
  yahoo: string;
  gf: string | null;
  name: string;
  note?: string | null; // Watchlist-style thesis note
}

export interface Watchlist {
  id: string;
  name: string;
  stocks: WatchStock[];
}

const KEY = "receipts.watchlists.v2";
const OLD_KEY = "receipts.watchlists.v1";
const SEEDED_TEMPLATES = ["watchlist-starter", "indian_large_caps", "nifty_50"];
const EVENT = "receipts-watchlists";

const SEED: Watchlist[] = [
  {
    id: "talked-about",
    name: "Stocks creators are talking about",
    stocks: [
      { yahoo: "PINELABS.NS", gf: "PINELABS:NSE", name: "Pine Labs" },
      { yahoo: "LALITHAA.NS", gf: "LALITHAA:NSE", name: "Lalithaa Jewellery Mart" },
      { yahoo: "IOLCP.NS", gf: "IOLCP:NSE", name: "IOL Chemicals and Pharmaceuticals" },
      { yahoo: "SUZLON.NS", gf: "SUZLON:NSE", name: "Suzlon Energy" },
    ],
  },
];

const fromTemplate = (id: string): Watchlist | null => {
  const t = LIST_TEMPLATES.find((x) => x.id === id);
  return t ? { id: `tpl-${t.id}`, name: t.name, stocks: t.stocks.map((s) => ({ ...s })) } : null;
};

// first visit: the creators list plus Watchlist's starter lists; a v1 visitor
// keeps their own lists and gets the starter lists added
function seed(base: Watchlist[]): Watchlist[] {
  const extra = SEEDED_TEMPLATES.map(fromTemplate).filter((l): l is Watchlist => !!l && !base.some((b) => b.id === l.id));
  return [...base, ...extra];
}

function read(): Watchlist[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const old = localStorage.getItem(OLD_KEY);
    if (old) return seed(JSON.parse(old));
  } catch {
    /* storage unavailable */
  }
  return seed(SEED);
}

function write(lists: Watchlist[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    /* storage unavailable: lists still work for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useWatchlists() {
  const [lists, setLists] = useState<Watchlist[]>(read);

  useEffect(() => {
    const sync = () => setLists(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: Watchlist[]) => {
    setLists(next);
    write(next);
  }, []);

  const create = (name: string) => {
    const l = { id: `${Date.now()}`, name: name.trim() || "New watchlist", stocks: [] };
    save([...lists, l]);
    return l.id;
  };
  const rename = (id: string, name: string) => save(lists.map((l) => (l.id === id ? { ...l, name } : l)));
  const remove = (id: string) => save(lists.filter((l) => l.id !== id));
  const add = (id: string, s: WatchStock) =>
    save(lists.map((l) => (l.id === id && !l.stocks.some((x) => x.yahoo === s.yahoo) ? { ...l, stocks: [...l.stocks, s] } : l)));
  const drop = (id: string, yahoo: string) => save(lists.map((l) => (l.id === id ? { ...l, stocks: l.stocks.filter((s) => s.yahoo !== yahoo) } : l)));
  const isWatched = (yahoo: string) => lists.some((l) => l.stocks.some((s) => s.yahoo === yahoo));
  const setNote = (id: string, yahoo: string, note: string) =>
    save(lists.map((l) => (l.id === id ? { ...l, stocks: l.stocks.map((s) => (s.yahoo === yahoo ? { ...s, note } : s)) } : l)));
  const addTemplate = (templateId: string) => {
    const l = fromTemplate(templateId);
    if (!l) return null;
    if (lists.some((x) => x.id === l.id)) return l.id;
    save([...lists, l]);
    return l.id;
  };

  return { lists, create, rename, remove, add, drop, isWatched, setNote, addTemplate };
}
