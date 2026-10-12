import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Claim } from "./claims";
import { creatorPath, fmtSubs, shortName, stockPath, useCreators, wilsonLower, type CreatorSummary } from "./data";
import { fmtDate, fmtTs, pct } from "./format";
import { Check, Cross, Play } from "./Icons";
import { onTenK, VERDICT } from "./plain";
import { Quote } from "./Quote";
import { VideoModal } from "./ReceiptCard";
import { SafeImg } from "./SafeImg";
import { storiesAbout } from "./scamNews";

// The human side of Receipts: faces, video thumbnails, one tip per card.

function Face({ src, name, size }: { src?: string | null; name: string; size: number }) {
  return (
    <SafeImg
      className="fc-face"
      src={src ?? undefined}
      alt=""
      width={size}
      height={size}
      fallback={
        <span className="fc-face fc-face-txt" style={{ width: size, height: size, fontSize: size * 0.4 }}>
          {name.slice(0, 1)}
        </span>
      }
    />
  );
}

const ratio = (c: CreatorSummary) => (c.scored ? c.beat / c.scored : null);

// Big portrait cards, one per creator, ordered by how much evidence there is.
export function CreatorFaces({ limit }: { limit?: number }) {
  const { creators } = useCreators();
  if (!creators) return <div className="faces faces-loading">{Array.from({ length: 4 }, (_, i) => <div key={i} className="face-card face-skel" />)}</div>;
  const list = [...creators].sort((a, b) => (b.scored ? wilsonLower(b.beat, b.scored) : -1) - (a.scored ? wilsonLower(a.beat, a.scored) : -1) || b.tips.length - a.tips.length).slice(0, limit);
  return (
    <div className="faces">
      {list.map((c) => {
        const r = ratio(c);
        const tone = r == null ? "muted" : r >= 0.5 ? "up" : "down";
        const graded = c.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]);
        const flagged = storiesAbout(`${c.report.channel} ${c.name}`).length > 0;
        return (
          <Link key={c.query} to={creatorPath(c.query)} className={`face-card is-${tone}`}>
            <span className="face-glow" aria-hidden="true" />
            <Face src={c.profile?.thumbnail} name={c.name} size={88} />
            <b className="face-name">{c.name}</b>
            <span className="face-subs">{c.profile?.subscribers ? `${fmtSubs(c.profile.subscribers)} subscribers` : `${c.tips.length} tips`}</span>
            <span className="face-score">
              {c.scored ? (
                <>
                  {c.beat}
                  <i>/{c.scored}</i>
                </>
              ) : (
                <i className="face-new">New</i>
              )}
            </span>
            <span className="face-label">{c.scored ? (c.scored < 3 ? "beat the market · small sample" : "tips beat the market") : "tips too recent to score"}</span>
            <span className="face-strip" aria-hidden="true">
              {graded.slice(0, 14).map((t) => (
                <i key={t.id} className={VERDICT[t.outcome!].good ? "y" : "n"} />
              ))}
            </span>
            {flagged && <span className="face-flag">SEBI action on record</span>}
          </Link>
        );
      })}
    </div>
  );
}

// One tip as a card: who said it, the moment, and what happened to ₹10,000.
export function TipCard({ t, creator, onPlay, showCreator = true }: { t: Claim; creator?: CreatorSummary | null; onPlay: (c: Claim) => void; showCreator?: boolean }) {
  const v = t.outcome && t.ret != null ? VERDICT[t.outcome] : null;
  const tone = v ? (v.good ? "up" : "down") : "muted";
  return (
    <article className={`tc is-${tone}`}>
      <button className="tc-thumb" onClick={() => onPlay(t)} aria-label={`Watch the moment at ${fmtTs(t.start_s)}`}>
        <SafeImg src={`https://i.ytimg.com/vi/${t.video.id}/hqdefault.jpg`} alt="" fallback={<span className="tc-thumb-missing" />} />
        <span className="tc-play">
          <Play size={14} /> {fmtTs(t.start_s)}
        </span>
      </button>
      <div className="tc-body">
        {showCreator && (
          <Link to={creatorPath(creator?.query ?? t.video.channel ?? "")} className="tc-who">
            <Face src={creator?.profile?.thumbnail} name={creator?.name ?? t.video.channel ?? "?"} size={28} />
            <span>
              <b>{creator?.name ?? t.video.channel}</b>
              <small>{fmtDate(t.video.date)}</small>
            </span>
          </Link>
        )}
        {!showCreator && <small className="tc-date">{fmtDate(t.video.date)}</small>}
        <p className="tc-quote">
          <Quote c={t} />
        </p>
        <div className="tc-foot">
          <Link to={stockPath(shortName(t.stock.name))} className="tc-stock">
            {shortName(t.stock.name)}
          </Link>
          {t.ret != null ? (
            <span className="tc-result">
              <b className={t.ret >= 0 ? "up" : "down"}>{pct(t.ret)}</b>
              <small>
                market {pct(t.mkt)} · ₹10k → {onTenK(t.ret).split("→ ")[1]}
              </small>
            </span>
          ) : (
            <span className="tc-result">
              <small>{t.outcome === "pending" ? "Too new to judge" : "Not scored"}</small>
            </span>
          )}
        </div>
        {v && (
          <span className={`tc-pill ${v.good ? "up" : "down"}`}>
            {v.good ? <Check size={13} /> : <Cross size={13} />}
            {v.good ? "Beat the market" : "Lost to the market"}
          </span>
        )}
      </div>
    </article>
  );
}

// The newest scored tips from every creator, as a feed.
export function TipFeed({ limit = 8 }: { limit?: number }) {
  const { creators } = useCreators();
  const [playing, setPlaying] = useState<Claim | null>(null);
  // newest first, but one tip per video and rotating between creators, so the feed is varied
  const rows = useMemo(() => {
    const scored = (creators ?? [])
      .flatMap((c) => c.tips.filter((t) => t.ret != null && t.outcome && VERDICT[t.outcome]).map((t) => ({ t, c })))
      .sort((a, b) => (b.t.video.date ?? "").localeCompare(a.t.video.date ?? "") || Math.abs(b.t.ret ?? 0) - Math.abs(a.t.ret ?? 0));
    const seenVideo = new Set<string>();
    const perCreator = new Map<string, typeof scored>();
    for (const r of scored) {
      if (seenVideo.has(r.t.video.id)) continue;
      seenVideo.add(r.t.video.id);
      perCreator.set(r.c.query, [...(perCreator.get(r.c.query) ?? []), r]);
    }
    const queues = [...perCreator.values()];
    const out: typeof scored = [];
    while (out.length < limit && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < limit) out.push(q.shift()!);
    return out;
  }, [creators, limit]);
  if (!creators) return null;
  return (
    <>
      <div className="feed">
        {rows.map(({ t, c }) => (
          <TipCard key={t.id} t={t} creator={c} onPlay={setPlaying} />
        ))}
      </div>
      {playing && <VideoModal c={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}
