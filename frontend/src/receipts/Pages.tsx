import { Fragment, useEffect, useMemo, useState } from "react";
import { NewsStrip } from "./NewsStrip";
import { CreatorFaces, TipCard, TipFeed } from "./Feed";
import { LiveCheck } from "./LiveCheck";
import { Quote } from "./Quote";
import { StocksTable } from "./StocksBoard";
import { useQuotes, useStockIndex } from "./stocksData";
import { PriceVolumeChart } from "./PriceVolumeChart";
import { Leaderboard, StatsLine } from "./Board";
import { ArrowRight, Check, ChevronDown, ChevronRight, Cross, External, Play, Share, Verified } from "./Icons";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { rawSerpUrl, receiptsApi, type HypeReport, type SerpSource } from "./api";
import { claimsFromStock, type Claim } from "./claims";
import { creatorPath, fmtSubs, shortName, stockPath, summarize, useCreator, useCreators, useTitle, type CreatorSummary } from "./data";
import { Finder } from "./Finder";
import { fmtDate, fmtTs, pct, stockNewsQuery } from "./format";
import { GuessGame } from "./GuessGame";
import { Headlines } from "./Headlines";
import { isSebiCaseStock } from "./hooks";
import { onTenK, storyOf, VERDICT } from "./plain";
import { ReceiptCard, VideoModal } from "./ReceiptCard";
import { SafeImg } from "./SafeImg";
import { RegulatoryAlert, ScamWatch } from "./ScamWatch";
import { storiesAbout } from "./scamNews";
import { PumpBadge } from "./shared";

/* ---------------- shared bits ---------------- */

function Avatar({ c, size }: { c: CreatorSummary; size: number }) {
  const txt = (
    <span className="av av-txt" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {c.name.slice(0, 1)}
    </span>
  );
  return <SafeImg className="av" src={c.profile?.thumbnail ?? undefined} alt="" width={size} height={size} fallback={txt} />;
}

function Score({ c, big }: { c: CreatorSummary; big?: boolean }) {
  if (!c.scored) return <div className={`sc sc-muted ${big ? "sc-big" : ""}`}><b>–</b><span>too new to judge</span></div>;
  const good = c.beat / c.scored >= 0.5;
  return (
    <div className={`sc ${good ? "sc-good" : "sc-bad"} ${big ? "sc-big" : ""}`}>
      <b>
        {c.beat}
        <i>/{c.scored}</i>
      </b>
      <span>tips beat the market</span>
    </div>
  );
}

function Ticks({ tips }: { tips: Claim[] }) {
  const graded = tips.filter((t) => t.outcome && VERDICT[t.outcome] && t.ret != null);
  return (
    <span className="ticks" aria-hidden="true">
      {graded.map((t) => (
        <i key={t.id} className={VERDICT[t.outcome!].good ? "y" : "n"} />
      ))}
    </span>
  );
}

function SearchBar() {
  const { creators, stocks } = useCreators();
  const nav = useNavigate();
  return (
    <Finder
      options={[
        ...(creators ?? []).map((c) => ({ kind: "creator" as const, query: c.query, label: c.name, sub: c.profile?.subscribers ? `${fmtSubs(c.profile.subscribers)} subscribers` : undefined })),
        ...stocks.filter((s) => !isSebiCaseStock(s.query)).map((s) => ({ kind: "stock" as const, query: s.query, label: shortName(s.label), sub: s.ticker ?? undefined })),
      ]}
      onPick={(o) => nav(o.kind === "creator" ? creatorPath(o.query) : stockPath(o.query))}
    />
  );
}

/* ---------------- creator grid ---------------- */

export function CreatorGrid({ limit }: { limit?: number }) {
  const { creators } = useCreators();
  if (!creators) return <div className="cg cg-loading">{Array.from({ length: 3 }, (_, i) => <div key={i} className="cg-card cg-skel" />)}</div>;
  return (
    <div className="cg">
      {creators.slice(0, limit).map((c) => (
        <Link key={c.query} to={creatorPath(c.query)} className="cg-card">
          <div className="cg-top">
            <Avatar c={c} size={52} />
            <div className="cg-id">
              <b>{c.name}</b>
              <span>{c.profile?.subscribers ? `${fmtSubs(c.profile.subscribers)} subscribers` : `${c.tips.length} tips`}</span>
            </div>
          </div>
          <Score c={c} />
          <div className="cg-foot">
            <Ticks tips={c.tips} />
            {storiesAbout(`${c.report.channel} ${c.name}`).length > 0 && <span className="cg-flag">SEBI action</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function StockChips() {
  const { stocks } = useCreators();
  return (
    <div className="chips">
      {stocks
        .filter((s) => !isSebiCaseStock(s.query))
        .map((s) => (
          <Link key={s.query} to={stockPath(s.query)}>
            {shortName(s.label)}
          </Link>
        ))}
      <Link to="/receipts/sebi-case" className="chip-red">
        Sadhna Broadcast · SEBI case
      </Link>
    </div>
  );
}

/* ---------------- home ---------------- */

export function HomePage() {
  useTitle("Did that YouTube stock tip actually work?");
  return (
    <div className="pg home">
      <section className="hx2">
        <div className="hx2-copy">
          <h1>Did that YouTube stock tip actually work?</h1>
          <p>We find the exact second a finfluencer recommended a stock, then check what it did over the next month against the market.</p>
          <SearchBar />
        </div>
        <StatsLine />
      </section>

      <NewsStrip />

      <section className="blk">
        <div className="blk-head">
          <h2>The creators</h2>
          <Link to="/receipts/creators" className="lnk">
            Full leaderboard <ArrowRight size={16} />
          </Link>
        </div>
        <CreatorFaces />
      </section>

      <section className="blk">
        <div className="blk-head">
          <h2>Latest receipts</h2>
          <span className="blk-hint">Tap a thumbnail to watch the exact moment</span>
        </div>
        <TipFeed limit={6} />
      </section>

      <section className="blk">
        <div className="blk-head">
          <h2>Stocks they named</h2>
          <Link to="/receipts/stocks" className="lnk">
            All stocks <ArrowRight size={16} />
          </Link>
        </div>
        <StockChips />
      </section>

      <GuessGame />

      <ScamWatch title="Scam watch" />

      <section className="blk how">
        <div className="blk-head">
          <h2>How it works</h2>
          <Link to="/receipts/about" className="lnk">More about Receipts <ArrowRight size={16} /></Link>
        </div>
        <ol>
          <li>
            <b>1</b>
            <span>We pull a creator's recent stock videos and transcripts.</span>
          </li>
          <li>
            <b>2</b>
            <span>AI finds each stock they recommend. If the exact words aren't in the transcript, it's thrown out.</span>
          </li>
          <li>
            <b>3</b>
            <span>A month later, we check: did it beat the market (India's top 50 companies)?</span>
          </li>
        </ol>
      </section>
    </div>
  );
}

export function CreatorsPage() {
  useTitle("Creators");
  const [q, setQ] = useState("");
  const { creators } = useCreators();
  const flagged = (creators ?? []).filter((c) => storiesAbout(`${c.report.channel} ${c.name}`).length > 0).length;
  return (
    <div className="pg">
      <section className="blk">
        <div className="pg-head">
          <div>
            <h1>Creators</h1>
            <p>Finance YouTubers whose recent stock tips we've checked. Click a row to see every tip, the exact moment it was said, and what happened next.</p>
          </div>
          <label className="mini-search">
            <span className="sr-only">Filter creators</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name" />
          </label>
        </div>
        {creators && (
          <p className="st">
            <span>
              <b>{creators.length}</b> creators
            </span>
            <span>
              <b>{creators.reduce((n, c) => n + c.report.videos.length, 0)}</b> videos checked
            </span>
            <span>
              <b>{creators.reduce((n, c) => n + c.tips.length, 0)}</b> tips found
            </span>
            <span>
              <b>{flagged}</b> with SEBI action on record
            </span>
          </p>
        )}
        <Leaderboard full filter={q} />
      </section>

      <section className="defs">
        <div>
          <b>Beat the market</b>
          <p>Tips whose stock did better than the Nifty 50 (India's top 50 companies) in the month after the video.</p>
        </div>
        <div>
          <b>Made money</b>
          <p>Tips whose stock was simply up a month later. A stock can lose money and still beat a falling market.</p>
        </div>
        <div>
          <b>Avg vs market</b>
          <p>On average, how many percentage points better or worse their tips did than the market.</p>
        </div>
        <div>
          <b>Small sample</b>
          <p>Fewer than 3 scored tips. Shown, but not ranked: one lucky call isn't a record.</p>
        </div>
      </section>

      <LiveCta />
    </div>
  );
}

export function StocksPage() {
  useTitle("Stocks");
  const [q, setQ] = useState("");
  return (
    <div className="pg">
      <section className="blk">
        <div className="pg-head">
          <div>
            <h1>Stocks</h1>
            <p>Every stock an audited creator told viewers to buy, plus stocks we checked for YouTube hype. Click any row for its full record.</p>
          </div>
          <label className="mini-search">
            <span className="sr-only">Filter stocks</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or ticker" />
          </label>
        </div>
        <p className="table-hint">
          <ChevronRight size={14} /> Click a stock to see its price chart, who recommended it and what happened next.
        </p>
        <StocksTable filter={q} />
        <p className="lb-note">
          Prices from Yahoo Finance, refreshed on load. “Avg month after tip” is the average move in the 30 days after the videos that named it.
        </p>
      </section>
    </div>
  );
}

/* ---------------- creator page ---------------- */

export function CreatorPage() {
  const { name = "" } = useParams();
  const direct = useCreator(name);
  // links may carry the channel's display name rather than the saved query:
  // only if the direct load misses, look the name up among all creators
  const { creators } = useCreators();
  const lower = name.toLowerCase();
  const match = direct.done && !direct.data ? creators?.find((x) => [x.query, x.name, x.report.channel].some((n) => n.toLowerCase() === lower)) : undefined;
  const fallback = useCreator(match?.query ?? null);
  const [liveData, setLiveData] = useState<CreatorSummary | null>(null);
  const c = liveData ?? direct.data ?? fallback.data;
  useTitle(c ? `${c.name}: stock tip record` : null);
  const done = !!c || (direct.done && (creators !== null && (!match || fallback.done)));
  const [playing, setPlaying] = useState<Claim | null>(null);
  const [filter, setFilter] = useState<"all" | "good" | "bad">("all");
  // ?tip=lalithaa opens the table with that tip's Details already open (a direct link for demos and sharing)
  const [params] = useSearchParams();
  const tipParam = params.get("tip")?.trim().toLowerCase() || null;
  const [view, setView] = useState<"feed" | "table" | "receipts">(tipParam ? "table" : "feed");

  if (!done) return <div className="pg"><p className="loading">Loading receipts…</p></div>;
  if (!c)
    return (
      <div className="pg">
        <div className="empty">
          <h1>We haven't checked “{name}” yet</h1>
          <p>Saved results cover the creators below. You can also check this one live, right now.</p>
        </div>
        <LiveCheck name={name} onDone={(r) => setLiveData(summarize(name, r, null))} />
        <section className="blk">
          <div className="blk-head">
            <h2>Already checked</h2>
          </div>
          <Leaderboard />
        </section>
      </div>
    );

  const shown = c.tips.filter((t) => filter === "all" || (t.outcome && VERDICT[t.outcome] && (VERDICT[t.outcome].good ? "good" : "bad") === filter));
  const stories = storiesAbout(`${c.report.channel} ${c.name}`);

  return (
    <div className="pg">
      <Link to="/receipts/creators" className="back">
        ← All creators
      </Link>
      <div className="banner" aria-hidden="true">
        {c.profile?.thumbnail && <img src={c.profile.thumbnail} alt="" referrerPolicy="no-referrer" />}
      </div>
      <header className="ph ph-row ph-hero">
        <Avatar c={c} size={112} />
        <div className="ph-id">
          <h1>
            {c.name}
            {c.profile?.verified && <Verified size={26} />}
          </h1>
          <p>{[c.profile?.handle, c.profile?.subscribers ? `${fmtSubs(c.profile.subscribers)} subscribers` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="ph-actions">
          {c.report.channel_url && (
            <a className="btn-ghost" href={c.report.channel_url} target="_blank" rel="noreferrer">
              YouTube channel <External size={14} />
            </a>
          )}
          <CopyLink />
        </div>
      </header>
      <p className="ph-summary">{summaryOf(c)}</p>
      {c.report.live && (
        <p className="live-done">
          <span className="live-dot" aria-hidden="true" /> Checked live just now, using {c.report.credits_used ?? "a few"} SerpApi searches. Prices from Yahoo Finance; news not checked in live mode.
        </p>
      )}

      <dl className="pstats">
        <div>
          <dt>Beat the market</dt>
          <dd className={c.scored ? (c.beat / c.scored >= 0.5 ? "up" : "down") : ""}>{c.scored ? `${c.beat} of ${c.scored}` : "–"}</dd>
        </div>
        <div>
          <dt>Made money</dt>
          <dd>{c.scored ? `${c.made} of ${c.scored}` : "–"}</dd>
        </div>
        <div>
          <dt>Avg vs market</dt>
          {(() => {
            const avg = c.scored ? (c.report.report_card?.all_scoreable.avg_excess_vs_nifty_30d_pct ?? null) : null;
            return <dd className={avg == null ? "" : avg >= 0 ? "up" : "down"}>{avg == null ? "–" : pct(avg)}</dd>;
          })()}
        </div>
        <div>
          <dt>Tips found</dt>
          <dd>{c.tips.length}</dd>
        </div>
        <div>
          <dt>Videos checked</dt>
          <dd>{c.report.videos.length}</dd>
        </div>
        <div>
          <dt>Last checked</dt>
          <dd className="pstats-date">{fmtDate(c.report.generated_at ?? null)}</dd>
        </div>
      </dl>

      {stories.length > 0 && <RegulatoryAlert stories={stories} />}
      {c.scored > 0 && c.scored < 5 && <p className="note">Only {c.scored} tips are old enough to judge, so this is a small sample.</p>}

      <BestWorst c={c} onPlay={setPlaying} />

      <div className="rl-head">
        <h2>Tips</h2>
        <div className="rl-tools">
        <div className="seg">
          {(
            [
              ["all", `All ${c.tips.length}`],
              ["good", "Beat the market"],
              ["bad", "Lost to it"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg seg-icons" aria-label="View">
          <button className={view === "feed" ? "on" : ""} onClick={() => setView("feed")}>
            Feed
          </button>
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>
            Table
          </button>
          <button className={view === "receipts" ? "on" : ""} onClick={() => setView("receipts")}>
            Receipts
          </button>
        </div>
        </div>
      </div>
      {view === "feed" && (
        <div className="feed">
          {shown.map((t) => (
            <TipCard key={t.id} t={t} creator={c} onPlay={setPlaying} showCreator={false} />
          ))}
        </div>
      )}
      {view === "table" && <TipTable tips={shown} onPlay={setPlaying} openTip={tipParam} />}
      {view === "receipts" && [...new Map(shown.map((t) => [t.video.id, t.video])).values()].map((v) => {
        const vt = shown.filter((t) => t.video.id === v.id);
        return (
          <section key={v.id} className="vg">
            <button className="vg-head" onClick={() => setPlaying(vt[0])}>
              <SafeImg src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" fallback={<span className="rcp-video-missing" />} />
              <span>
                <small>
                  {fmtDate(v.date)} · {vt.length} {vt.length === 1 ? "tip" : "tips"} in this video
                </small>
                <b>{v.title}</b>
              </span>
            </button>
            <div className="rl">
              {vt.map((t) => (
                <ReceiptCard key={t.id} c={t} n={c.tips.indexOf(t) + 1} onPlay={setPlaying} thumb={false} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="blk">
        <div className="rl-head">
          <h2>Videos we checked</h2>
        </div>
        <ul className="vids">
          {[...c.report.videos]
            .sort((a, b) => (b.published_date ?? "").localeCompare(a.published_date ?? ""))
            .map((v) => {
              const vt = c.tips.filter((t) => t.video.id === v.video_id);
              return (
                <li key={v.video_id}>
                  <button onClick={() => (vt[0] ? setPlaying(vt[0]) : window.open(v.url, "_blank", "noopener"))}>
                    <SafeImg src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`} alt="" fallback={<span className="rcp-video-missing" />} />
                    <span className="vids-body">
                      <b>{v.title}</b>
                      <small>
                        {fmtDate(v.published_date)}
                        {v.views ? ` · ${v.views.toLocaleString("en-IN")} views` : ""}
                      </small>
                    </span>
                    <span className="vids-count">{vt.length ? `${vt.length} ${vt.length === 1 ? "tip" : "tips"}` : "no stock tips"}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </section>

      <Headlines
        title="In the news"
        fixed={(c.report.regulatory?.news ?? []).slice(0, 3).map((n) => ({ title: n.title, url: n.url, source: n.source ?? null, date: n.date ?? null, tag: "SEBI case" }))}
        sources={[...new Map(c.tips.map((t) => [t.stock.name, t])).values()].slice(0, 3).map((t) => ({ query: stockNewsQuery(t.stock.name), label: shortName(t.stock.name).split(" ")[0], match: t.stock.name }))}
        perSource={2}
        limit={6}
        hint="Google News via SerpApi"
      />

      {playing && <VideoModal c={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/* ---------------- stock page ---------------- */

export function StockPage() {
  const { name = "" } = useParams();
  const index = useStockIndex();
  const [hype, setHype] = useState<HypeReport | null | undefined>(undefined);
  const [playing, setPlaying] = useState<Claim | null>(null);
  const key = name.toLowerCase();
  const row = index?.find((r) => r.query.toLowerCase() === key || r.key === key || r.key.startsWith(key) || key.startsWith(r.key)) ?? null;

  // ask for the stock check under the name it was saved as; a stock that was
  // only named by creators (no saved check) doesn't need one
  const hypeQuery = index === null ? null : row ? (row.videos ? row.query : null) : key;
  useEffect(() => {
    if (index === null) return;
    let alive = true;
    if (!hypeQuery) {
      Promise.resolve().then(() => alive && setHype(null));
      return () => {
        alive = false;
      };
    }
    receiptsApi
      .hype(hypeQuery)
      .then((r) => alive && setHype(r))
      .catch(() => alive && setHype(null));
    return () => {
      alive = false;
    };
  }, [hypeQuery, index]);

  const yahoo = row?.yahoo ?? hype?.ticker?.yahoo_symbol ?? null;
  const quotes = useQuotes(yahoo ? [yahoo] : []);
  const q = yahoo ? quotes[yahoo] : undefined;
  const fromHype = useMemo(() => (hype ? claimsFromStock(hype).filter((c) => c.direction !== "watch") : []), [hype]);
  const title = shortName(hype?.ticker?.name ?? row?.name ?? name);
  useTitle(title);

  if (hype === undefined || index === null) return <div className="pg"><p className="loading">Loading…</p></div>;
  const tips = row?.tips ?? [];
  if (!tips.length && !fromHype.length) return <NotAudited what={title} />;
  const ticker = hype?.ticker?.google_finance ?? row?.gf ?? null;
  const points = hype?.series?.points?.length ? hype.series.points : (q?.points ?? []);
  const from = points.length ? points[Math.max(0, points.length - 260)].date : undefined;
  // one labelled dot per creator tip on the price line (latest tips only, so labels don't collide)
  const notes = [...new Map(tips.filter((t) => t.video.date && (!from || t.video.date >= from)).map((t) => [t.video.date!, t])).values()]
    .slice(0, 4)
    .map((t) => ({ date: t.video.date!, label: `${(t.video.channel ?? "Tip").split(" ")[0]}: ${t.direction}`, tone: "amber" as const }));
  const markers = [...new Set((hype?.videos ?? []).map((v) => v.published_date).filter((d): d is string => !!d && (!from || d >= from)))].map((date) => ({ date, label: "YouTube video" }));

  return (
    <div className="pg">
      <Link to="/receipts/stocks" className="back">
        ← All stocks
      </Link>
      <header className="ph ph-row">
        <span className="ph-tick">{(ticker ?? title).split(":")[0].slice(0, 7)}</span>
        <div className="ph-id">
          <h1>{title}</h1>
          <p>
            {ticker ?? "Not matched to a listing"}
            {q?.price != null && (
              <>
                {" · "}
                <b className="ph-price">₹{q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</b>{" "}
                <span className={(q.change_pct ?? 0) >= 0 ? "up" : "down"}>{pct(q.change_pct)} today</span>
              </>
            )}
          </p>
        </div>
      </header>

      <dl className="pstats">
        <div>
          <dt>Tips from creators</dt>
          <dd>{tips.length}</dd>
        </div>
        <div>
          <dt>Beat the market</dt>
          <dd className={row?.scored ? (row.beat / row.scored >= 0.5 ? "up" : "down") : ""}>{row?.scored ? `${row.beat} of ${row.scored}` : "–"}</dd>
        </div>
        <div>
          <dt>Avg month after tip</dt>
          <dd className={row?.avgRet == null ? "" : row.avgRet >= 0 ? "up" : "down"}>{row?.avgRet == null ? "–" : pct(row.avgRet)}</dd>
        </div>
        <div>
          <dt>YouTube videos found</dt>
          <dd>{hype?.videos.length ?? "–"}</dd>
        </div>
        <div>
          <dt>Pump-and-dump check</dt>
          <dd className="pstats-date">{hype?.pump_check ? <PumpBadge level={hype.pump_check.level} /> : "Not checked"}</dd>
        </div>
        <div>
          <dt>52-week range</dt>
          <dd className="pstats-date">{q?.stats ? `₹${Math.round(q.stats.week52_low)} – ₹${Math.round(q.stats.week52_high)}` : "–"}</dd>
        </div>
      </dl>

      <RegulatoryAlert stories={storiesAbout(title)} />

      {points.length > 1 && (
        <section className="db-card">
          <div className="db-card-head">
            <h2 className="card-h">Price, with the days it was talked about</h2>
            <span className="db-hint">{hype?.series ? (hype.series.source === "google_finance" ? "Google Finance via SerpApi" : "Yahoo Finance") : "Yahoo Finance"}</span>
          </div>
          <PriceVolumeChart points={points} notes={notes} markers={markers} from={from} height={300} />
        </section>
      )}

      {tips.length > 0 && (
        <>
          <div className="rl-head">
            <h2>Tips from creators we checked</h2>
          </div>
          <TipTable tips={tips} onPlay={setPlaying} col="creator" />
        </>
      )}

      {fromHype.length > 0 && (
        <>
          <div className="rl-head">
            <h2>Other videos that talked about it</h2>
          </div>
          <ul className="mentions">
            {fromHype.slice(0, 12).map((m) => (
              <li key={m.id}>
                <button onClick={() => setPlaying(m)}>
                  <SafeImg src={`https://i.ytimg.com/vi/${m.video.id}/mqdefault.jpg`} alt="" fallback={<span className="rcp-video-missing" />} />
                  <span>
                    <small>
                      {m.video.channel} · {fmtDate(m.video.date)} · <Play size={11} /> {fmtTs(m.start_s)}
                    </small>
                    <b>
                      <Quote c={m} />
                    </b>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Headlines sources={[{ query: stockNewsQuery(hype?.ticker?.name ?? tips[0]?.stock.name ?? title), match: title }]} perSource={5} limit={5} title={`Latest on ${title}`} />
      {playing && <VideoModal c={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function NotAudited({ what }: { what: string }) {
  return (
    <div className="pg">
      <div className="empty">
        <h1>No receipts for “{what}” yet</h1>
        <p>This public demo shows saved results only, because each new check uses paid search credits. Try one of these:</p>
        <CreatorGrid limit={3} />
      </div>
    </div>
  );
}

function TipTable({
  tips,
  onPlay,
  col = "stock",
  openTip = null,
}: {
  tips: Claim[];
  onPlay: (c: Claim) => void;
  col?: "stock" | "creator";
  openTip?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(() => (openTip ? (tips.find((t) => t.stock.name.toLowerCase().includes(openTip))?.id ?? null) : null));
  useEffect(() => {
    if (!openTip) return;
    const id = setTimeout(() => document.querySelector(".tt-detail")?.previousElementSibling?.scrollIntoView({ block: "start", behavior: "smooth" }), 400);
    return () => clearTimeout(id);
  }, [openTip]);
  return (
    <div className="lb-wrap">
      <table className="lb tt">
        <thead>
          <tr>
            <th>Date</th>
            <th>{col === "stock" ? "Stock" : "Creator"}</th>
            <th>What they said</th>
            <th className="num">Stock</th>
            <th className="num">Market</th>
            <th className="num">₹10,000 became</th>
            <th>Result</th>
            <th>
              <span className="sr-only">Details and video</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tips.map((t) => {
            const v = t.outcome && t.ret != null ? VERDICT[t.outcome] : null;
            const isOpen = open === t.id;
            return (
              <Fragment key={t.id}>
              <tr className={isOpen ? "tt-open" : ""}>
                <td className="tt-date">{fmtDate(t.video.date)}</td>
                <td>
                  {col === "stock" ? (
                    <>
                      <Link to={stockPath(shortName(t.stock.name))} className="tt-stock">
                        {shortName(t.stock.name)}
                      </Link>
                      <small className="tt-sym">{t.stock.gf ?? ""}</small>
                    </>
                  ) : (
                    <Link to={creatorPath(t.video.channel ?? "")} className="tt-stock">
                      {t.video.channel}
                    </Link>
                  )}
                </td>
                <td className="tt-q" title={t.quoteEn ? `${t.quote} (${t.quoteEn})` : t.quote}>
                  <Quote c={t} />
                </td>
                <td className={`num ${t.ret == null ? "dim" : t.ret >= 0 ? "up" : "down"}`}>{t.ret == null ? "–" : pct(t.ret)}</td>
                <td className={`num ${t.mkt == null ? "dim" : t.mkt >= 0 ? "up" : "down"}`}>{t.mkt == null ? "–" : pct(t.mkt)}</td>
                <td className="num">{t.ret == null ? <span className="dim">–</span> : onTenK(t.ret).split("→ ")[1]}</td>
                <td>
                  {v ? (
                    <span className={`tag ${v.good ? "tag-up" : "tag-down"}`}>
                      {v.good ? <Check size={13} /> : <Cross size={13} />}
                      {v.good ? "Beat market" : "Lost to market"}
                    </span>
                  ) : (
                    <span className="tag">{t.outcome === "pending" ? "Too new" : "Not scored"}</span>
                  )}
                </td>
                <td className="tt-actions">
                  <button
                    className={`tt-how ${isOpen ? "is-open" : ""}`}
                    onClick={() => setOpen(isOpen ? null : t.id)}
                    aria-expanded={isOpen}
                    title="See how this tip was checked"
                  >
                    Details <ChevronDown size={13} />
                  </button>
                  <button className="lr-play" onClick={() => onPlay(t)} aria-label={`Watch the moment at ${fmtTs(t.start_s)}`} title={`Watch at ${fmtTs(t.start_s)}`}>
                    <Play size={14} />
                  </button>
                </td>
              </tr>
              {isOpen && (
                <tr className="tt-detail">
                  <td colSpan={8}>
                    <AuditTrail t={t} onPlay={onPlay} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function summaryOf(c: CreatorSummary) {
  const graded = c.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]);
  if (!graded.length) return `We found ${c.tips.length} stock ${c.tips.length === 1 ? "tip" : "tips"} in ${c.report.videos.length} recent videos. None is a month old yet, so there's nothing to score.`;
  const best = graded.reduce((a, b) => ((b.ret ?? 0) > (a.ret ?? 0) ? b : a));
  const worst = graded.reduce((a, b) => ((b.ret ?? 0) < (a.ret ?? 0) ? b : a));
  const lead = `${c.beat} of ${c.scored} scored ${c.scored === 1 ? "tip" : "tips"} beat the market a month later, and ${c.made} made money.`;
  const other = otherWindows(c.tips);
  if (graded.length === 1) return `${lead}${other}`;
  return `${lead}${other} Best call: ${shortName(best.stock.name)} (${pct(best.ret)}). Worst: ${shortName(worst.stock.name)} (${pct(worst.ret)}).`;
}

// " After a week it was 8 of 9; after 3 months, 1 of 2." Shows the score isn't
// an accident of the one-month window.
function otherWindows(tips: Claim[]) {
  const parts = (
    [
      [7, "after a week it was"],
      [90, "after 3 months,"],
    ] as const
  ).flatMap(([days, words]) => {
    const done = tips.flatMap((t) => t.windows.filter((w) => w.days === days && w.status === "done" && w.right != null));
    return done.length ? [`${words} ${done.filter((w) => w.right).length} of ${done.length}`] : [];
  });
  if (!parts.length) return "";
  const s = parts.join("; ");
  return ` ${s[0].toUpperCase()}${s.slice(1)}.`;
}

function BestWorst({ c, onPlay }: { c: CreatorSummary; onPlay: (t: Claim) => void }) {
  const graded = c.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]);
  if (graded.length < 2) return null;
  const best = graded.reduce((a, b) => ((b.ret ?? 0) > (a.ret ?? 0) ? b : a));
  const worst = graded.reduce((a, b) => ((b.ret ?? 0) < (a.ret ?? 0) ? b : a));
  return (
    <div className="bw">
      {(
        [
          ["Best call", best],
          ["Worst call", worst],
        ] as const
      ).map(([label, t]) => (
        <button key={label} className={`bw-card ${(t.ret ?? 0) >= 0 ? "is-up" : "is-down"}`} onClick={() => onPlay(t)}>
          <span className="bw-label">{label}</span>
          <span className="bw-main">
            <b>{shortName(t.stock.name)}</b>
            <span className="bw-ret">{pct(t.ret)}</span>
          </span>
          <Quote c={t} className="bw-q" />
          <span className="bw-foot">
            {fmtDate(t.video.date)} · market {pct(t.mkt)} · ₹10,000 became {onTenK(t.ret ?? 0).split("→ ")[1]}
            <span className="bw-play">
              <Play size={12} /> {fmtTs(t.start_s)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-ghost"
      onClick={() => {
        navigator.clipboard
          ?.writeText(window.location.href)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          })
          .catch(() => {});
      }}
    >
      {done ? <Check size={14} /> : <Share size={14} />}
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

function LiveCta() {
  const [name, setName] = useState("");
  const nav = useNavigate();
  return (
    <section className="cta-row">
      <div>
        <b>Check any creator, live</b>
        <p>Type a YouTube channel name. We'll search their recent stock videos through SerpApi, read the transcripts and score every tip, in about a minute.</p>
      </div>
      <form
        className="cta-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) nav(creatorPath(name.trim()));
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CA Rachana Ranade" aria-label="YouTube channel name" />
        <button className="btn-paper" type="submit" disabled={name.trim().length < 2}>
          Check live
        </button>
      </form>
    </section>
  );
}

// Every step behind one verdict, so a reader can check it instead of trusting it.
function AuditTrail({ t, onPlay }: { t: Claim; onPlay: (c: Claim) => void }) {
  const source = t.priceSource === "google_finance" ? "Google Finance (via SerpApi)" : t.priceSource === "yahoo" ? "Yahoo Finance" : null;
  return (
    <ol className="trail">
      <li>
        <span className="trail-n">1</span>
        <div>
          <b>The words, in the transcript</b>
          <p>
            Found word for word at{" "}
            <button className="trail-link" onClick={() => onPlay(t)}>
              {fmtTs(t.start_s)} in “{t.video.title}”
            </button>
            . Quotes that can't be found in the transcript are thrown out.
          </p>
          {t.context.length > 0 && (
            <div className="trail-ctx">
              {t.context.map((l) => (
                <div key={l.start_s} className={l.start_s === t.start_s ? "hit" : ""}>
                  <span>{fmtTs(l.start_s)}</span>
                  {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </li>
      <li>
        <span className="trail-n">2</span>
        <div>
          <b>The stock</b>
          <p>
            {t.stock.heard ? `Heard as “${t.stock.heard}”, ` : ""}matched to <strong>{shortName(t.stock.name)}</strong>
            {t.stock.gf ? ` (${t.stock.gf})` : ""}
            {t.stock.correctedViaSearch ? " after a Google search corrected the spelling" : " through a listing search"}. The match must share a real word,
            ticker or acronym with what was said.
          </p>
        </div>
      </li>
      <li>
        <span className="trail-n">3</span>
        <div>
          <b>The prices</b>
          {t.entry && t.exit ? (
            <p>
              ₹{t.entry.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })} on {fmtDate(t.entry.date)} (the video day) → ₹
              {t.exit.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })} on {fmtDate(t.exit.date)}, a month later: <strong>{pct(t.ret)}</strong>.
              {source ? ` Prices from ${source}.` : ""}
            </p>
          ) : (
            <p>{t.outcome === "pending" ? "A month hasn't passed since the video, so there's nothing to compare yet." : "No reliable price history around the video date, so this tip isn't scored."}</p>
          )}
        </div>
      </li>
      <li>
        <span className="trail-n">4</span>
        <div>
          <b>Against the market</b>
          <p>{t.mkt != null ? `Over the same days the Nifty 50 moved ${pct(t.mkt)}. ${storyOf(t.ret, t.mkt, t.direction) ?? ""}` : "No market comparison for this tip."}</p>
          {t.windows.some((w) => w.status === "done") && <Windows t={t} />}
        </div>
      </li>
      <li className="trail-wide">
        <span className="trail-n">5</span>
        <div>
          <b>The SerpApi data behind it</b>
          <SerpSources t={t} />
        </div>
      </li>
    </ol>
  );
}

// The same tip judged over other windows, so a verdict isn't an accident of
// picking one convenient date.
function Windows({ t }: { t: Claim }) {
  return (
    <table className="trail-win">
      <caption>Does it hold over other time windows?</caption>
      <thead>
        <tr>
          <th scope="col">After</th>
          <th scope="col">Stock</th>
          <th scope="col">Market</th>
          <th scope="col">Tip</th>
        </tr>
      </thead>
      <tbody>
        {t.windows.map((w) => (
          <tr key={w.days} className={w.days === 30 ? "main" : undefined}>
            <th scope="row">{w.label}</th>
            <td>{w.status === "done" ? pct(w.ret) : "–"}</td>
            <td>{w.status === "done" ? pct(w.mkt) : "–"}</td>
            <td className={w.right == null ? "" : w.right ? "up" : "down"}>
              {w.status === "done" ? (w.right ? "✓ right" : "✗ wrong") : w.status === "pending" ? "not yet" : "no data"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The exact SerpApi responses a tip was built from, each viewable as raw JSON.
function SerpSources({ t }: { t: Claim }) {
  const [list, setList] = useState<SerpSource[] | null>(null);
  useEffect(() => {
    let alive = true;
    receiptsApi
      .sources(t.video.id, t.stock.gf, t.video.channel)
      .then((r) => alive && setList(r.sources))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [t.video.id, t.stock.gf, t.video.channel]);
  if (list === null) return <p>Loading…</p>;
  if (!list.length) return <p>No saved SerpApi responses for this tip.</p>;
  return (
    <ul className="serp-src">
      {list.map((s) => (
        <li key={s.file}>
          <span className="serp-step">{s.label}</span>
          <code className="serp-eng">engine={s.engine}</code>
          <span className="serp-q">
            {Object.entries(s.params)
              .filter(([k]) => !["engine", "hl", "gl"].includes(k))
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </span>
          <span className="serp-meta">
            {s.created_at ? `fetched ${s.created_at.replace(" UTC", "")} UTC` : ""}
            {s.search_id ? ` · search ${s.search_id.slice(0, 10)}…` : ""}
          </span>
          <a href={rawSerpUrl(s.file)} target="_blank" rel="noreferrer" className="serp-raw">
            Raw JSON <External size={12} />
          </a>
        </li>
      ))}
    </ul>
  );
}
