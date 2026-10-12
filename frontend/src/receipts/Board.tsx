import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Claim } from "./claims";
import { creatorPath, fmtSubs, shortName, stockPath, useCreators, wilsonLower, type CreatorSummary } from "./data";
import { fmtDate, pct } from "./format";
import { Check, ChevronRight, Cross, Play } from "./Icons";
import { sayDirection, VERDICT } from "./plain";
import { VideoModal } from "./ReceiptCard";
import { SafeImg } from "./SafeImg";
import { storiesAbout } from "./scamNews";

// Data-dense views: what a real research site shows on its front page.

const latestAudit = (cs: CreatorSummary[]) =>
  cs.map((c) => c.report.generated_at ?? "").sort().pop() ?? "";

export function StatsLine() {
  const { creators, stocks } = useCreators();
  if (!creators) return <p className="st">&nbsp;</p>;
  const tips = creators.reduce((n, c) => n + c.tips.length, 0);
  const scored = creators.reduce((n, c) => n + c.scored, 0);
  const beat = creators.reduce((n, c) => n + c.beat, 0);
  const named = new Set([...creators.flatMap((c) => c.tips.map((t) => shortName(t.stock.name).toLowerCase())), ...stocks.map((s) => shortName(s.label).toLowerCase())]).size;
  return (
    <p className="st">
      <span>
        <b>{creators.length}</b> creators audited
      </span>
      <span>
        <b>{tips}</b> tips found
      </span>
      <span>
        <b>{named}</b> stocks named
      </span>
      <span>
        <b>{scored ? Math.round((beat / scored) * 100) : 0}%</b> of scored tips beat the market
      </span>
      <span className="st-date">Data as of {fmtDate(latestAudit(creators))}</span>
    </p>
  );
}

function Face({ c, size = 32 }: { c: CreatorSummary; size?: number }) {
  return (
    <SafeImg
      className="lb-face"
      src={c.profile?.thumbnail ?? undefined}
      alt=""
      width={size}
      height={size}
      fallback={
        <span className="lb-face lb-face-txt" style={{ width: size, height: size }}>
          {c.name.slice(0, 1)}
        </span>
      }
    />
  );
}

export function Leaderboard({ full = false, filter = "" }: { full?: boolean; filter?: string }) {
  const { creators } = useCreators();
  const nav = useNavigate();
  if (!creators) return <div className="lb-skel" />;
  // a rank needs a few scored tips; 1 of 1 is luck, not a record
  const MIN = 3;
  const ranked = (c: CreatorSummary) => c.scored >= MIN;
  const rows = [...creators].sort((a, b) => {
    if (ranked(a) !== ranked(b)) return ranked(a) ? -1 : 1;
    const ra = a.scored ? wilsonLower(a.beat, a.scored) : -1;
    const rb = b.scored ? wilsonLower(b.beat, b.scored) : -1;
    return rb - ra || b.scored - a.scored;
  });
  let rank = 0;
  return (
    <div className="lb-wrap">
      <table className="lb">
        <thead>
          <tr>
            <th className="lb-rank">#</th>
            <th>Creator</th>
            <th className="num">Subscribers</th>
            <th className="num">Tips</th>
            <th className="num">Beat the market</th>
            <th className="num">Made money</th>
            <th className="num">Avg vs market</th>
            <th>Record</th>
            {full && <th className="num">Videos</th>}
            {full && <th className="num">Last checked</th>}
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const isRanked = ranked(c);
            const myRank = isRanked ? ++rank : null;
            if (filter && !c.name.toLowerCase().includes(filter.trim().toLowerCase())) return null;
            const avg = c.report.report_card?.all_scoreable.avg_excess_vs_nifty_30d_pct ?? null;
            const flagged = storiesAbout(`${c.report.channel} ${c.name}`).length > 0;
            const graded = c.tips.filter((t) => t.outcome && VERDICT[t.outcome] && t.ret != null);
            return (
              <tr key={c.query} className="row-link" tabIndex={0} onClick={() => nav(creatorPath(c.query))} onKeyDown={(e) => e.key === "Enter" && nav(creatorPath(c.query))}>
                <td className="lb-rank">{myRank ?? "–"}</td>
                <td>
                  <Link to={creatorPath(c.query)} className="lb-who">
                    <Face c={c} />
                    <span>
                      <b>{c.name}</b>
                      {flagged && <i className="lb-flag">SEBI action</i>}
                    </span>
                  </Link>
                </td>
                <td className="num dim">{fmtSubs(c.profile?.subscribers) || "–"}</td>
                <td className="num">{c.tips.length}</td>
                <td className="num">
                  {c.scored ? (
                    <>
                      <b className={c.beat / c.scored >= 0.5 ? "up" : "down"}>
                        {c.beat}/{c.scored}
                      </b>
                      {!ranked(c) && <small className="lb-small">small sample</small>}
                    </>
                  ) : (
                    <span className="dim">too new</span>
                  )}
                </td>
                <td className="num">{c.scored ? `${c.made}/${c.scored}` : <span className="dim">–</span>}</td>
                <td className={`num ${avg == null ? "dim" : avg >= 0 ? "up" : "down"}`}>{avg == null || !c.scored ? "–" : pct(avg)}</td>
                <td>
                  <span className="lb-ticks">
                    {graded.slice(0, 12).map((t) => (
                      <i key={t.id} className={VERDICT[t.outcome!].good ? "y" : "n"} title={`${shortName(t.stock.name)}: ${pct(t.ret)}`} />
                    ))}
                  </span>
                </td>
                {full && <td className="num">{c.report.videos.length}</td>}
                {full && <td className="num tt-date">{fmtDate(c.report.generated_at ?? null)}</td>}
                <td className="go">
                  <span>
                    View <ChevronRight size={15} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="lb-note">Ranked by how many scored tips beat the Nifty 50 one month after the video, adjusted for sample size (a Wilson score), so 9 of 17 counts for more than 2 of 3. Creators need at least 3 scored tips to be ranked; tips less than a month old aren't scored yet.</p>
    </div>
  );
}

export function LatestReceipts({ limit = 8 }: { limit?: number }) {
  const { creators } = useCreators();
  const [playing, setPlaying] = useState<Claim | null>(null);
  const nav = useNavigate();
  if (!creators) return null;
  const rows = creators
    .flatMap((c) => c.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]).map((t) => ({ t, c })))
    .sort((a, b) => (b.t.exit?.date ?? "").localeCompare(a.t.exit?.date ?? ""))
    .slice(0, limit);
  return (
    <>
      <ul className="lr">
        {rows.map(({ t, c }) => {
          const good = VERDICT[t.outcome!].good;
          return (
            <li key={t.id} className="row-link" tabIndex={0} onClick={() => nav(creatorPath(c.query))} onKeyDown={(e) => e.key === "Enter" && nav(creatorPath(c.query))}>
              <span className={`lr-mark ${good ? "y" : "n"}`}>{good ? <Check size={14} /> : <Cross size={14} />}</span>
              <span className="lr-main">
                <span className="lr-line">
                  <Link to={creatorPath(c.query)} onClick={(e) => e.stopPropagation()}>{c.name}</Link> {sayDirection(t.direction).toLowerCase()} <Link to={stockPath(shortName(t.stock.name))} onClick={(e) => e.stopPropagation()}>{shortName(t.stock.name)}</Link>
                </span>
                <span className="lr-q">“{t.quoteEn ?? t.quote}”</span>
              </span>
              <span className="lr-nums">
                <b className={(t.ret ?? 0) >= 0 ? "up" : "down"}>{pct(t.ret)}</b>
                <small>market {pct(t.mkt)}</small>
              </span>
              <span className="lr-date">{fmtDate(t.video.date)}</span>
              <button className="lr-play" onClick={(e) => { e.stopPropagation(); setPlaying(t); }} aria-label="Watch the moment">
                <Play size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {playing && <VideoModal c={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}
