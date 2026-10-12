import { useEffect, useState } from "react";
import { useTitle } from "./data";
import { receiptsApi, type CaseStudy as CaseStudyT } from "./api";
import { fmtDate } from "./format";
import { caseNotes, tenKAtPeak } from "./caseFacts";
import { PriceVolumeChart } from "./PriceVolumeChart";
import { PatternDisclaimer, PumpBadge, PumpRules } from "./shared";

// The validation case: SEBI already ruled on this one. Receipts gets only
// the stock and the video upload dates from the order; everything it flags
// comes from live Google Finance data run through the same rules used for
// any other stock.
export function CaseStudy() {
  useTitle("The SEBI case");
  const [data, setData] = useState<CaseStudyT | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    receiptsApi.sebiCase().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="rc-error">{error}</p>;
  if (!data) return <p className="rc-muted">Loading the case…</p>;

  const { case: c, series, pump_check: pc } = data;
  const m = pc.metrics;
  const markers = c.video_uploads.map((v) => ({ date: v.date, label: "Videos posted" }));

  return (
    <div className="rc-stack">
      <section className="rc-hero">
        <div className="rc-kicker">The evidence · SEBI final order, {fmtDate(c.order_date)}</div>
        <h2>Would Receipts have caught a scam that SEBI later proved?</h2>
        <p className="rc-lede">
          In 2022, YouTube channels including <b>Moneywise</b> and <b>The Advisor</b> told viewers to buy shares of a tiny
          company, <b>{c.company}</b>. SEBI, India's market regulator, later found the videos were misleading and paid for,
          and that people linked to the company sold their shares while viewers were buying.
        </p>
        <p className="rc-lede">
          We gave Receipts only two facts from SEBI's order: the company and the dates the videos went up. Everything
          else on this page comes from public share-price data.
        </p>
        <div className="rc-hero-verdict">
          <PumpBadge level={pc.level} />
          <span className="rc-muted">
            {pc.fired.length === 4 ? "All 4" : `${pc.fired.length} of 4`} warning signs showed up after the first video (
            {fmtDate(pc.promotion_date_used)})
          </span>
        </div>
      </section>

      <section className="rc-money-line">
        <span>Someone who put in</span> <b>₹10,000</b> <span>at the peak had about</span>{" "}
        <b className="rc-neg">₹{tenKAtPeak(data).toLocaleString("en-IN")}</b> <span>left seven months later.</span>
      </section>

      <section className="rc-explainer">
        <b>What's a pump-and-dump?</b> Someone buys a cheap stock nobody trades, gets people excited about it (here, through
        YouTube videos), and sells once the price shoots up. The price then crashes, and the people who bought late lose
        their money.
      </section>

      <p className="rc-readguide">
        <b>How to read the chart.</b> The line is the share price; the bars are shares traded each week. Follow the three
        markers: ① the videos begin, ② the price peaks, ③ it collapses.
      </p>

      <section className="rc-card">
        <div className="rc-card-head">
          <h3>What happened to the share price</h3>
          <span className="rc-source">Google Finance data via SerpApi · {series.symbol}</span>
        </div>
        <PriceVolumeChart
          points={series.points}
          markers={markers}
          from="2022-01-01"
          to="2023-06-30"
          highlight={[c.investigation_period[0], c.investigation_period[1]]}
          notes={caseNotes(data)}
          height={360}
        />
        <p className="rc-caption">
          Green line: share price. Bars: shares traded each week. Dashed lines: when the videos went up. Red shading: the
          period SEBI investigated. Free price sources like Yahoo Finance have no data for this stock at all, so Google
          Finance (via SerpApi) is what makes this check possible.
        </p>
      </section>

      <div className="rc-grid-2">
        <section className="rc-card">
          <h3>What Receipts found</h3>
          <PumpRules check={pc} />
          <div className="rc-stats">
            <div>
              <span>Price when the videos started</span>
              <b>₹{m.price_at_promotion}</b>
            </div>
            <div>
              <span>Highest price</span>
              <b>
                ₹{m.peak_price} <small>{fmtDate(String(m.peak_date))}</small>
              </b>
            </div>
            <div>
              <span>Trading vs before the videos</span>
              <b>{m.volume_spike_x}×</b>
            </div>
            <div>
              <span>Fall from the high</span>
              <b className="rc-neg">−{m.drawdown_from_peak_pct}%</b>
            </div>
          </div>
        </section>

        <section className="rc-card">
          <h3>What SEBI found</h3>
          <ul className="rc-findings">
            {c.order_findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <h4>Videos listed in the order</h4>
          <ul className="rc-uploads">
            {c.video_uploads.map((v, i) => (
              <li key={i}>
                <span>{fmtDate(v.date)}</span> {v.channel}
              </li>
            ))}
          </ul>
          <a className="rc-link" href={c.order_url} target="_blank" rel="noreferrer">
            Read the full order on sebi.gov.in ↗
          </a>
        </section>
      </div>
      <PatternDisclaimer />
    </div>
  );
}
