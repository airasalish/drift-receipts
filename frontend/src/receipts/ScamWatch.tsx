import { SCAM_STORIES, type ScamStory } from "./scamNews";
import { SafeImg } from "./SafeImg";
import { External } from "./Icons";

function Face({ s, size }: { s: ScamStory; size: number }) {
  const letter = (
    <span className="cf-face cf-face-txt" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {(s.who ?? "S").replace(/^A /, "").slice(0, 1)}
    </span>
  );
  if (!s.image) return letter;
  return <SafeImg className={`cf-face cf-face-${s.image.kind}`} src={s.image.src} alt={s.who ?? ""} title={s.image.credit} width={size} height={size} fallback={letter} />;
}

const Status = ({ s }: { s: ScamStory }) => <span className={`cf-status ${s.status === "Final order" ? "is-final" : ""}`}>{s.status}</span>;

// "Scam watch" as a case file: the lead case large, the rest as tidy rows.
export function ScamWatch({ stories = SCAM_STORIES, title = "Scam watch" }: { stories?: ScamStory[]; title?: string }) {
  const [lead, ...rest] = stories;
  if (!lead) return null;
  return (
    <section className="cf">
      <div className="cf-head">
        <div>
          <span className="cf-kicker">Case file</span>
          <h2>{title}</h2>
        </div>
        <p>Real SEBI actions against stock-tip schemes, with the original reports. Interim orders are allegations, not final findings.</p>
      </div>

      <div className="cf-grid">
        <a className="cf-lead" href={lead.url} target="_blank" rel="noreferrer">
          <div className="cf-lead-top">
            <Face s={lead} size={64} />
            <div>
              <span className="cf-kind">{lead.kind}</span>
              <b className="cf-who">{lead.who}</b>
            </div>
            <Status s={lead} />
          </div>
          <div className="cf-amount">{lead.amount}</div>
          <h3>{lead.hook ?? lead.headline}</h3>
          <p>{lead.headline}</p>
          <span className="cf-src">
            {lead.outlet} · {lead.date}
            <External size={14} />
          </span>
        </a>

        <ol className="cf-list">
          {rest.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                <Face s={s} size={40} />
                <span className="cf-row">
                  <span className="cf-row-top">
                    <span className="cf-kind">{s.kind}</span>
                    <Status s={s} />
                  </span>
                  <b>{s.hook ?? s.headline}</b>
                  <small>
                    {s.who} · {s.outlet}, {s.date}
                  </small>
                </span>
                <span className="cf-row-amt">{s.amount}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Shown at the top of a creator or stock page when a regulatory story is about them.
export function RegulatoryAlert({ stories }: { stories: ScamStory[] }) {
  if (!stories.length) return null;
  return (
    <div className="sw-alert" role="note">
      <span className="sw-alert-icon" aria-hidden="true">!</span>
      <div>
        <b>SEBI action on record</b>
        {stories.map((s) => (
          <p key={s.id}>
            {s.headline}.{" "}
            <span className="sw-alert-meta">
              {s.status}, {s.date}.{" "}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.outlet} <External size={13} />
              </a>
            </span>
          </p>
        ))}
        <small>
          {stories.some((s) => s.status === "Interim order")
            ? "An interim order states SEBI's allegations; it is not a final ruling and can be challenged."
            : "Orders like this can be appealed."}{" "}
          This audit scores the videos on their own merits.
        </small>
      </div>
    </div>
  );
}
