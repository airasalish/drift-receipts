import { useEffect, useMemo, useState } from "react";
import { Quote } from "./Quote";
import { ArrowRight, Check, Cross, Share, TrendDown, TrendUp } from "./Icons";
import { SafeImg } from "./SafeImg";
import { Link } from "react-router-dom";
import { receiptsApi } from "./api";
import { claimsFromChannel, type Claim } from "./claims";
import { fmtDate, fmtTs, pct } from "./format";
import { useExamples } from "./hooks";
import { onTenK, storyOf, VERDICT } from "./plain";

// "Guess the tip": one real, already-scored YouTube tip at a time. Guess,
// see the answer, next. Teaches "better than the market" by playing.

type Guess = "beat" | "lost";

function shuffle<T>(xs: T[], seed: number) {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function GuessGame() {
  const examples = useExamples();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0 });
  const [seed] = useState(() => Date.now() % 1000);

  const names = (examples?.channels ?? []).map((c) => c.query).join("|");
  useEffect(() => {
    if (!names) return;
    let alive = true;
    Promise.all(names.split("|").map((n) => receiptsApi.channel(n).then(claimsFromChannel).catch(() => [] as Claim[]))).then((lists) => {
      if (!alive) return;
      const scored = lists.flat().filter((c) => c.ret != null && c.mkt != null && c.outcome && VERDICT[c.outcome] && c.direction === "buy");
      // one card per quote
      const seen = new Set<string>();
      const unique = shuffle(scored.filter((c) => !seen.has(c.quote) && seen.add(c.quote)), seed);
      // quotes in Hindi script go last: most first-time visitors read English
      const hindi = (c: Claim) => /[\u0900-\u097F]/.test(c.quote);
      setClaims([...unique.filter((c) => !hindi(c)), ...unique.filter(hindi)]);
    });
    return () => {
      alive = false;
    };
  }, [names, seed]);

  const c = claims?.[i % (claims.length || 1)];
  const truth: Guess | null = c?.outcome ? (VERDICT[c.outcome].good ? "beat" : "lost") : null;
  const right = guess != null && guess === truth;
  const done = claims != null && score.played > 0 && score.played % 5 === 0 && guess != null;

  const answer = (g: Guess) => {
    if (guess || !truth) return;
    setGuess(g);
    setScore((s) => ({ right: s.right + (g === truth ? 1 : 0), played: s.played + 1 }));
  };
  const next = () => {
    setGuess(null);
    setI((x) => x + 1);
  };

  const dots = useMemo(() => Array.from({ length: 5 }, (_, k) => k < score.played % 5 || (done && k < 5)), [score.played, done]);

  if (claims === null) return <section className="gx gx-loading">Loading real tips…</section>;
  if (!c) return null;

  return (
    <section className="gx" aria-live="polite">
      <div className="gx-head">
        <div>
          <span className="gx-kicker">Play</span>
          <h2>Guess the tip</h2>
          <p>A real quote from a real video. Did that stock beat the market a month later?</p>
        </div>
        <div className="gx-score" aria-label={`Score ${score.right} of ${score.played}`}>
          <span className="gx-bars">
            {dots.map((on, k) => (
              <i key={k} className={on ? "on" : ""} />
            ))}
          </span>
          <b>
            {score.right}
            <span>/{score.played}</span>
          </b>
        </div>
      </div>

      <div className={`gx-card ${guess ? (right ? "is-right" : "is-wrong") : ""}`}>
        <div className="gx-quote">
          <div className="gx-src">
            <SafeImg src={`https://i.ytimg.com/vi/${c.video.id}/mqdefault.jpg`} alt="" fallback={<span className="gx-thumb-missing" />} />
            <span>
              <b>{c.video.channel}</b>
              <small>
                {fmtDate(c.video.date)} · at {fmtTs(c.start_s)}
              </small>
            </span>
          </div>
          <blockquote>
            <Quote c={c} />
          </blockquote>
          <span className="gx-stock">{c.stock.name.replace(/ Limited$/, "")}</span>
        </div>

        <div className="gx-side">
          {!guess ? (
            <>
              <p className="gx-q">Your call</p>
              <button className="gx-btn gx-up" onClick={() => answer("beat")}>
                <TrendUp size={20} />
                <span>Beat the market</span>
              </button>
              <button className="gx-btn gx-down" onClick={() => answer("lost")}>
                <TrendDown size={20} />
                <span>Lost to it</span>
              </button>
            </>
          ) : (
            <div className="gx-result">
              <div className="gx-verdict">
                <span className="gx-mark">{right ? <Check size={18} /> : <Cross size={18} />}</span>
                {right ? "You called it" : "Not this time"}
              </div>
              <dl className="gx-lines">
                <div>
                  <dt>This stock</dt>
                  <dd className={c.ret! >= 0 ? "up" : "down"}>{pct(c.ret)}</dd>
                </div>
                <div>
                  <dt>The market</dt>
                  <dd className={c.mkt! >= 0 ? "up" : "down"}>{pct(c.mkt)}</dd>
                </div>
                <div className="gx-total">
                  <dt>₹10,000 became</dt>
                  <dd className={c.ret! >= 0 ? "up" : "down"}>{onTenK(c.ret!).split("→ ")[1]}</dd>
                </div>
              </dl>
              <p className="gx-story">{storyOf(c.ret, c.mkt, c.direction)}</p>
              <button className="gx-next" onClick={next} autoFocus>
                {done ? "Play 5 more" : "Next tip"}
                <ArrowRight size={18} />
              </button>
              {done && <ShareScore right={score.right} played={score.played} />}
              <Link className="gx-more" to={`/receipts/c/${encodeURIComponent(c.video.channel ?? "")}`}>
                All of {c.video.channel?.split(" ")[0]}'s receipts
              </Link>
            </div>
          )}
        </div>
      </div>
      {done && guess && <p className="gx-sum">You called {score.right} of {score.played}. A confident voice isn't a track record.</p>}
    </section>
  );
}

function ShareScore({ right, played }: { right: number; played: number }) {
  const [copied, setCopied] = useState(false);
  const text = `I called ${right} of ${played} real YouTuber stock tips. Can you beat that?`;
  const url = `${window.location.origin}/receipts`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Guess the tip", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed or clipboard blocked */
    }
  };
  return (
    <button className="gx-share" onClick={share}>
      {copied ? <Check size={16} /> : <Share size={16} />}
      {copied ? "Copied" : "Share your score"}
    </button>
  );
}
