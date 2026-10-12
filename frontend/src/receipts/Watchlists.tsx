import { Fragment, useEffect, useRef, useState } from "react";
import { useTitle } from "./data";
import { ChartIcon, ChevronDown, Cross, Plus } from "./Icons";
import { Link } from "react-router-dom";
import { StockChart, type ChartRangeOut, type ChartStock } from "./chart/StockChart";
import { receiptsApi, type Ticker, type WatchRow } from "./api";
import { LIST_TEMPLATES } from "./templates";
import { fmtDate, pct } from "./format";
import { Spark } from "./Spark";
import { useWatchlists, type Watchlist, type WatchStock } from "./watchlistStore";

// Watchlist's watchlists, rebuilt for Receipts: several named lists, a chart per
// stock, and -- the new part -- which audited creators have talked about it.
export function Watchlists() {
  useTitle("Watchlists");
  const wl = useWatchlists();
  const [activeId, setActiveId] = useState<string | null>(wl.lists[0]?.id ?? null);
  const active = wl.lists.find((l) => l.id === activeId) ?? wl.lists[0] ?? null;
  const [creating, setCreating] = useState(false);

  return (
    <div className="wl">
      <header className="pg-head">
        <div>
          <h1>Watchlists</h1>
          <p>Track stocks you care about: live prices, anything unusual today, and which YouTube creators have been talking about them. Saved in this browser, no account needed.</p>
        </div>
        <button className="btn-ghost" onClick={() => setCreating(true)}>
          <Plus size={15} /> New watchlist
        </button>
      </header>
      {creating && (
        <NewListDialog
          taken={wl.lists.map((l) => l.id)}
          onClose={() => setCreating(false)}
          onCreate={(name) => {
            setActiveId(wl.create(name));
            setCreating(false);
          }}
          onTemplate={(id) => {
            setActiveId(wl.addTemplate(id));
            setCreating(false);
          }}
        />
      )}

      <div className="wl-grid">
        <nav className="wl-lists">
          <div className="db-label">Your lists</div>
          {wl.lists.map((l) => (
            <button key={l.id} className={active?.id === l.id ? "on" : ""} onClick={() => setActiveId(l.id)}>
              <b>{l.name}</b>
              <small>{l.stocks.length}</small>
            </button>
          ))}
        </nav>
        {active ? <ListView key={active.id} list={active} wl={wl} /> : <p className="rc-muted">Create a watchlist to start.</p>}
      </div>
    </div>
  );
}

function ListView({ list, wl }: { list: Watchlist; wl: ReturnType<typeof useWatchlists> }) {
  const [rows, setRows] = useState<Record<string, WatchRow>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(list.name);
  const sig = list.stocks.map((s) => s.yahoo).join(",");

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

  return (
    <section className="wl-main">
      <div className="wl-main-head">
        <div>
          <input className="wl-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => wl.rename(list.id, name.trim() || list.name)} aria-label="Watchlist name (click to rename)" title="Click to rename" />
          <span className="wl-meta">
            {list.stocks.length} {list.stocks.length === 1 ? "stock" : "stocks"} · prices from Yahoo Finance
          </span>
        </div>
        <button
          className="btn-ghost btn-sm btn-danger"
          onClick={() => {
            if (window.confirm(`Delete the list "${list.name}"? This can't be undone.`)) wl.remove(list.id);
          }}
        >
          Delete list
        </button>
      </div>
      <div className="wl-toolbar">
        <AddStock onAdd={(t) => wl.add(list.id, { yahoo: t.yahoo_symbol, gf: t.google_finance, name: t.name })} />
      </div>

      {list.stocks.length === 0 ? (
        <p className="wl-empty">No stocks in this list yet. Search for one above to start tracking it.</p>
      ) : (
        <>
        <p className="table-hint">
          <ChartIcon size={14} /> Click any stock to open its candlestick chart, 52-week range and your note.
        </p>
        <table className="wl-table lb">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Price</th>
              <th>Day</th>
              <th>6 months</th>
              <th>What's unusual</th>
              <th>Creator mentions</th>
              <th>
                <span className="sr-only">Chart</span>
              </th>
              <th>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.stocks.map((s) => {
              const r = rows[s.yahoo];
              const isOpen = open === s.yahoo;
              return (
                <Fragment key={s.yahoo}>
                  <tr className={`row-link ${isOpen ? "on" : ""}`} onClick={() => setOpen(isOpen ? null : s.yahoo)} title={isOpen ? "Hide chart" : "Show chart"}>
                    <td>
                      <b>{s.name}</b>
                      <small>{s.gf ?? s.yahoo}</small>
                    </td>
                    <td>{r?.price != null ? `₹${r.price.toLocaleString("en-IN")}` : "…"}</td>
                    <td className={r?.change_pct != null ? (r.change_pct >= 0 ? "rc-pos" : "rc-neg") : ""}>{pct(r?.change_pct)}</td>
                    <td>{r ? <Spark points={r.points} width={112} height={30} /> : null}</td>
                    <td>
                      {r?.signals.length ? (
                        <div className="wl-signals">
                          {r.signals.map((sg) => (
                            <span key={sg.message} className={`tag ${sg.tone === "up" ? "tag-up" : sg.tone === "down" ? "tag-down" : ""}`}>
                              {sg.message}
                            </span>
                          ))}
                        </div>
                      ) : r ? (
                        <span className="dim">Nothing unusual</span>
                      ) : null}
                      {s.note && <div className="wl-note-inline">“{s.note}”</div>}
                    </td>
                    <td>
                      {r?.mentions.length ? (
                        <span className="wl-mentions">
                          {r.mentions.length} {r.mentions.length === 1 ? "mention" : "mentions"}
                          <small>{new Set(r.mentions.map((m) => m.channel)).size} channels</small>
                        </span>
                      ) : (
                        <span className="dim">–</span>
                      )}
                    </td>
                    <td>
                      <span className={`chart-toggle ${isOpen ? "is-open" : ""}`} aria-hidden="true">
                        <ChartIcon size={15} />
                        {isOpen ? "Hide" : "Chart"}
                        <ChevronDown size={14} />
                      </span>
                    </td>
                    <td>
                      <button
                        className="db-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          wl.drop(list.id, s.yahoo);
                        }}
                        aria-label={`Remove ${s.name}`}
                      >
                        <Cross size={16} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && r && (
                    <tr className="wl-open">
                      <td colSpan={8}>
                        <div className="wl-detail">
                          <div className="wl-chart">
                            <StockChart item={asChartStock(s, r)} loadChart={loadChart} />
                            {r.stats && (
                              <div className="wl-stats">
                                <span>
                                  52-week range <b>₹{r.stats.week52_low.toLocaleString("en-IN")}</b> – <b>₹{r.stats.week52_high.toLocaleString("en-IN")}</b>
                                </span>
                                <span>
                                  Usual daily move <b>±{r.stats.avg_daily_move_pct}%</b>
                                </span>
                              </div>
                            )}
                            <label className="wl-note">
                              <span>Your note (why you're watching)</span>
                              <textarea
                                defaultValue={s.note ?? ""}
                                placeholder="e.g. Waiting for a price, earnings next week…"
                                onBlur={(e) => wl.setNote(list.id, s.yahoo, e.target.value.trim())}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </label>
                          </div>
                          <div className="wl-who">
                            <h4>Who's been talking about it</h4>
                            {r.mentions.length ? (
                              <ul>
                                {r.mentions.slice(0, 8).map((m, i) => (
                                  <li key={i}>
                                    <a href={m.timestamp_url} target="_blank" rel="noreferrer">
                                      “{m.quote}”
                                    </a>
                                    <small>
                                      {m.channel} · {fmtDate(m.date)} · {m.direction.toUpperCase()}
                                    </small>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="rc-muted">
                                No saved creator mentions. <Link to={`/receipts/investigate?stock=${encodeURIComponent(s.name)}`}>Trace this stock</Link>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </>
      )}
    </section>
  );
}

function AddStock({ onAdd }: { onAdd: (t: Ticker) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Ticker[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // short input: results are hidden at render time
    let alive = true;
    const t = setTimeout(() => {
      receiptsApi
        .lookup(term)
        .then((r) => alive && setResults(r.results))
        .catch(() => alive && setResults([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="wl-add sb-field">
      <input className="db-filter" placeholder="Add a stock: name or symbol, e.g. Tata Motors" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && results.length > 0 && (
        <ul className="sb-list">
          {results.map((r) => (
            <li
              key={r.yahoo_symbol}
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(r);
                setQ("");
                setResults([]);
              }}
            >
              <span>{r.name}</span>
              <small>{r.google_finance ?? r.yahoo_symbol}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Watchlist's chart panel reads Watchlist's own row shape; build the slice it uses.
const loadChart = (symbol: string, range: string) => receiptsApi.chart(symbol, range) as unknown as Promise<ChartRangeOut>;

function asChartStock(s: WatchStock, r: WatchRow): ChartStock {
  const prev = r.price != null && r.change_pct != null ? r.price / (1 + r.change_pct / 100) : null;
  return {
    symbol: s.yahoo,
    company_name: s.name,
    company_website: null,
    quote: { currency: "INR", price: r.price, prev_close: prev, volume: r.stats?.volume ?? null, is_stale: false },
  };
}

// Creating a list is a choice: name an empty one, or start from a pre-made one.
function NewListDialog({ taken, onClose, onCreate, onTemplate }: { taken: string[]; onClose: () => void; onCreate: (name: string) => void; onTemplate: (id: string) => void }) {
  const [mode, setMode] = useState<"blank" | "template">("blank");
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === "blank") nameRef.current?.focus();
  }, [mode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const templates = LIST_TEMPLATES.filter((t) => !taken.includes(`tpl-${t.id}`));
  const canSubmit = mode === "blank" ? name.trim().length > 0 : !!tpl;
  const submit = () => {
    if (!canSubmit) return;
    if (mode === "blank") onCreate(name.trim());
    else onTemplate(tpl!);
  };

  return (
    <div className="wl-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wl-modal" role="dialog" aria-modal="true" aria-labelledby="wl-modal-title">
        <div className="wl-modal-head">
          <h3 id="wl-modal-title">New watchlist</h3>
          <button className="wl-modal-x" onClick={onClose} aria-label="Close">
            <Cross size={20} />
          </button>
        </div>
        <div className="wl-seg" role="tablist">
          <button role="tab" aria-selected={mode === "blank"} className={mode === "blank" ? "on" : ""} onClick={() => setMode("blank")}>
            Start empty
          </button>
          <button role="tab" aria-selected={mode === "template"} className={mode === "template" ? "on" : ""} onClick={() => setMode("template")}>
            Use a pre-made list
          </button>
        </div>

        {mode === "blank" ? (
          <label className="wl-field">
            <span>Name</span>
            <input ref={nameRef} value={name} maxLength={40} placeholder="e.g. Stocks to research" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <small>You can add stocks once it is created.</small>
          </label>
        ) : templates.length ? (
          <div className="wl-tpls">
            {templates.map((t) => (
              <button key={t.id} className={tpl === t.id ? "on" : ""} onClick={() => setTpl(t.id)} onDoubleClick={() => onTemplate(t.id)}>
                <b>{t.name}</b>
                <small>{t.description}</small>
                <span>
                  {t.stocks
                    .slice(0, 4)
                    .map((x) => x.yahoo.replace(/\.(NS|BO)$/, ""))
                    .join(" · ")}
                  {t.stocks.length > 4 ? ` +${t.stocks.length - 4}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rc-muted">Every pre-made list is already in your lists.</p>
        )}

        <div className="wl-modal-foot">
          <button className="wl-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="wl-btn" disabled={!canSubmit} onClick={submit}>
            {mode === "blank" ? "Create list" : "Add list"}
          </button>
        </div>
      </div>
    </div>
  );
}
