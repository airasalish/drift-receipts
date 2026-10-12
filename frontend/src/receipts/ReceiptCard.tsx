import { useEffect } from "react";
import { Quote } from "./Quote";
import { Check, Cross, External, Play } from "./Icons";
import { Link } from "react-router-dom";
import type { Claim } from "./claims";
import { creatorPath, shortName, stockPath } from "./data";
import { fmtDate, fmtTs, pct } from "./format";
import { onTenK, VERDICT } from "./plain";
import { SafeImg } from "./SafeImg";

const rupee = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

function stampOf(c: Claim) {
  if (c.ret != null && c.outcome && VERDICT[c.outcome]) {
    const v = VERDICT[c.outcome];
    return { text: v.good ? "Beat the market" : "Lost to the market", tone: v.good ? "good" : "bad" };
  }
  if (c.outcome === "pending") return { text: "Too new to judge", tone: "muted" };
  return { text: "Not scored", tone: "muted" };
}

// One tip, printed as a receipt: what was said, then what it would have done to ₹10,000.
export function ReceiptCard({ c, n, onPlay, show = "stock", thumb = true }: { c: Claim; n?: number; onPlay: (c: Claim) => void; show?: "stock" | "creator"; thumb?: boolean }) {
  const stamp = stampOf(c);
  return (
    <article className={`rcp rcp-${stamp.tone}`}>
      {thumb && (
        <button className="rcp-video" onClick={() => onPlay(c)} aria-label={`Play the moment at ${fmtTs(c.start_s)}`}>
          <SafeImg src={`https://i.ytimg.com/vi/${c.video.id}/mqdefault.jpg`} alt="" fallback={<span className="rcp-video-missing" />} />
          <span className="rcp-play"><Play size={13} /> {fmtTs(c.start_s)}</span>
        </button>
      )}

      <div className={`rcp-paper ${thumb ? "" : "rcp-top"}`}>
        {!thumb && (
          <button className="rcp-watch" onClick={() => onPlay(c)}>
            <Play size={14} />
            <span>Watch them say it</span>
            <span className="rcp-watch-ts">{fmtTs(c.start_s)}</span>
          </button>
        )}
        <div className="rcp-meta">
          <span>RECEIPT{n != null ? ` #${String(n).padStart(2, "0")}` : ""}</span>
          <span>{fmtDate(c.video.date)}</span>
        </div>
        <p className="rcp-quote">
          <Quote c={c} />
        </p>
        <div className="rcp-who">
          {show === "stock" ? (
            <Link to={stockPath(shortName(c.stock.name))}>{shortName(c.stock.name)}</Link>
          ) : (
            <Link to={creatorPath(c.video.channel ?? "")}>{c.video.channel}</Link>
          )}
          <span className="rcp-dir">{c.direction === "buy" ? "said BUY" : c.direction === "sell" ? "said SELL" : c.direction === "avoid" ? "said AVOID" : ""}</span>
        </div>

        <hr />
        {c.ret != null && c.entry && c.exit ? (
          <dl className="rcp-lines">
            <div>
              <dt>Price on video day</dt>
              <dd>{rupee(c.entry.price)}</dd>
            </div>
            <div>
              <dt>A month later</dt>
              <dd>{rupee(c.exit.price)}</dd>
            </div>
            <div>
              <dt>This stock</dt>
              <dd className={c.ret >= 0 ? "up" : "down"}>{pct(c.ret)}</dd>
            </div>
            <div>
              <dt>The market</dt>
              <dd className={(c.mkt ?? 0) >= 0 ? "up" : "down"}>{pct(c.mkt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="rcp-none">{c.outcome === "pending" ? "A month hasn't passed since the video yet." : "No reliable price data for this one."}</p>
        )}
        <hr />
        <div className="rcp-total">
          {c.ret != null ? (
            <>
              <span>₹10,000 became</span>
              <b className={c.ret >= 0 ? "up" : "down"}>{onTenK(c.ret).split("→ ")[1]}</b>
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        <div className={`rcp-stamp rcp-stamp-${stamp.tone}`}>
          {stamp.tone === "good" ? <Check size={15} /> : stamp.tone === "bad" ? <Cross size={15} /> : null}
          {stamp.text}
        </div>
      </div>
    </article>
  );
}

export function VideoModal({ c, onClose }: { c: Claim; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="vm" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={c.video.title}>
      <div className="vm-box">
        <div className="vm-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${c.video.id}?start=${c.start_s}&autoplay=1&rel=0&modestbranding=1`}
            title={c.video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="vm-foot">
          <div>
            <b>{c.video.title}</b>
            <span>
              {c.video.channel} · {fmtDate(c.video.date)} · starts at {fmtTs(c.start_s)}
            </span>
          </div>
          <div className="vm-actions">
            <a href={c.timestamp_url} target="_blank" rel="noreferrer">
              Open on YouTube <External size={14} />
            </a>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
