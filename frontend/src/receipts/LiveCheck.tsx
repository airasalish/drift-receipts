import { useEffect, useState } from "react";
import { isDemoMiss, receiptsApi, type ChannelReport, type FirstLook, type LiveStatus } from "./api";
import { Link } from "react-router-dom";
import { creatorPath } from "./data";
import { Check } from "./Icons";

const STEPS = [
  "Searching YouTube for their recent stock videos",
  "Pulling the transcripts",
  "Reading every stock they named, and checking each quote word for word",
  "Matching companies to NSE/BSE listings",
  "Comparing each stock with the market a month later",
];

// A real, on-demand audit: a few SerpApi searches plus the AI reading the
// transcripts. The steps advance on a timer (the server answers once, at the
// end), so they say what is happening, not exactly when.
export function LiveCheck({ name, onDone }: { name: string; onDone: (r: ChannelReport) => void }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState<ChannelReport | null>(null);
  const [look, setLook] = useState<FirstLook | null>(null);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    receiptsApi
      .liveStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, reason: "Live checks aren't available right now." }));
    // free: what the AI already knows about this name, before any search
    receiptsApi
      .firstLook(name)
      .then(setLook)
      .catch(() => setLook({ available: false }));
  }, [name]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [running]);

  const run = () => {
    setRunning(true);
    setStep(0);
    setError(null);
    setEmpty(null);
    receiptsApi
      .liveCheck(name)
      .then((r) => {
        if (r.status !== "ok" || !r.calls?.length) {
          setEmpty(r);
          setRunning(false);
          return;
        }
        onDone(r);
      })
      .catch((e) => {
        setError(isDemoMiss(e) ? "Live checks aren't available right now." : e instanceof Error ? e.message : "The live check failed.");
        setRunning(false);
      });
  };

  if (!status) return null;
  const skipping = !!look?.skip_search && !override && !running && !empty;
  return (
    <section className="live">
      <div className="live-head">
        <span className="live-dot" aria-hidden="true" />
        <div>
          {skipping ? (
            <h2>“{look?.channel || name}” doesn't give stock tips</h2>
          ) : (
            <>
              <h2>Run a live check on “{name}”</h2>
              <p>
                This searches YouTube right now through SerpApi, reads their latest stock videos, and scores every tip. It takes about a
                minute{status.searches_per_check ? ` and uses up to ${status.searches_per_check} searches` : ""}.
              </p>
            </>
          )}
        </div>
      </div>
      {look?.available && look.known && look.about && (
        <div className={`fl ${look.skip_search ? "fl-no" : ""}`}>
          <span className="fl-tag">AI first look · free</span>
          <p>
            <b>{look.channel || name}</b>: {look.about}
          </p>
          {look.skip_search ? (
            <p className="fl-verdict">
              Not a stock-advice channel, so there are no stock tips to keep score on. This comes from the AI's general knowledge, not a
              check of their videos.
            </p>
          ) : look.gives_stock_tips === "often" || look.gives_stock_tips === "sometimes" ? (
            <p className="fl-verdict">Known to talk about stocks. Run the live check to see the actual tips and whether they worked.</p>
          ) : null}
        </div>
      )}
      {skipping ? (
        status.enabled ? (
          <button
            className="btn-ghost"
            onClick={() => {
              setOverride(true);
              run();
            }}
          >
            Check their videos anyway
          </button>
        ) : null
      ) : !status.enabled ? (
        <div className="live-off">
          <p>{status.reason}</p>
          {status.local_only && (
            <p>
              They work when you run Receipts yourself with a SerpApi key: setup takes a few minutes, see the{" "}
              <a href="https://github.com/airasalish/receipts#run-it-locally" target="_blank" rel="noreferrer">
                README on GitHub
              </a>
              . The demo video shows one running.
            </p>
          )}
        </div>
      ) : running ? (
        <ol className="live-steps" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>
              <span className="live-mark">{i < step ? <Check size={13} /> : i === step ? <span className="live-spin" /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
      ) : (
        <button className="btn-paper" onClick={run}>
          Run live check
        </button>
      )}
      {error && <p className="live-err">{error}</p>}
      {empty && <NoTips name={name} r={empty} />}
      <small className="live-note">
        To protect the free search allowance, each visitor can run one check every few minutes, and checks pause when the month's allowance runs low.
      </small>
    </section>
  );
}

// A real answer, not an error: the channel was checked and simply gives no stock tips.
function NoTips({ name, r }: { name: string; r: ChannelReport }) {
  const videos = r.videos ?? [];
  const onlyWatch = (r.calls ?? []).length > 0;
  return (
    <div className="live-empty">
      <b>{videos.length ? `We read ${name}'s ${videos.length === 1 ? "latest video" : `${videos.length} latest stock-related videos`}. No stock tips.` : `We couldn't find stock videos from “${name}”.`}</b>
      <p>
        {videos.length
          ? `${onlyWatch ? "Stocks came up in passing, but" : "None of them"} recommended buying or selling a specific stock, so there's nothing to score. Receipts only keeps score on stock tips.`
          : "Either the channel doesn't post about stocks, or the name didn't match a YouTube channel. Try the exact channel name."}
      </p>
      {!videos.length && (r.suggestions?.length ?? 0) > 0 && (
        <div className="live-sugg">
          <span>Did you mean</span>
          {r.suggestions!.map((s) => (
            <Link key={s} to={creatorPath(s)}>
              {s}
            </Link>
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <ul>
          {videos.slice(0, 4).map((v) => (
            <li key={v.video_id}>
              <a href={v.url} target="_blank" rel="noreferrer">
                {v.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
