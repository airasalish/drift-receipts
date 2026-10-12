import { Link } from "react-router-dom";
import type { PumpCheck } from "./api";

const LEVEL_COPY: Record<string, { label: string; cls: string }> = {
  full_pattern: { label: "Classic pump-and-dump pattern", cls: "rc-badge-red" },
  pump_in_progress: { label: "Spiked, no crash yet", cls: "rc-badge-amber" },
  partial: { label: "Some warning signs", cls: "rc-badge-muted" },
  none: { label: "No warning signs", cls: "rc-badge-muted" },
};

export function PumpBadge({ level }: { level?: string }) {
  if (!level) return null;
  const c = LEVEL_COPY[level] ?? LEVEL_COPY.none;
  return <span className={`rc-badge ${c.cls}`}>{c.label}</span>;
}

// Every sign shows its exact numbers -- and the ones that didn't show up are
// listed too, so "3 of 4" is visible rather than implied.
export function PumpRules({ check }: { check: PumpCheck }) {
  if (check.status !== "ok") return <p className="rc-muted">Not enough price history around that date to check.</p>;
  const fired = new Map(check.fired.map((f) => [f.rule, f]));
  const all: [string, string][] = [
    ["illiquid", "Hardly anyone was trading it before the videos"],
    ["volume_spike", "Trading jumped at least 10× after the videos"],
    ["price_runup", "The price at least doubled"],
    ["collapse", "Then it lost at least half its value"],
  ];
  return (
    <ul className="rc-rules">
      {all.map(([key, label]) => {
        const f = fired.get(key as never);
        return (
          <li key={key} className={f ? "fired" : ""}>
            <span className="rc-rule-dot" aria-hidden="true" />
            <div>
              <div className="rc-rule-label">{label}</div>
              <div className="rc-rule-detail">{f ? f.detail : "not seen"}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PatternDisclaimer() {
  return (
    <p className="rc-disclaimer">
      This is a pattern in public price data, not proof that anyone did anything wrong. Not investment advice.
    </p>
  );
}

// Shown instead of a red error when the public demo has no saved result.
export function DemoNote({ what }: { what: string }) {
  return (
    <div className="rc-demo-note">
      <p>
        <b>This public demo shows saved results only</b>, so {what} can't be checked live here. Live checks run on paid
        search credits and are available in the full version.
      </p>
      <Link className="rc-button" to="/receipts/sebi-case">
        See the SEBI pump-and-dump case instead →
      </Link>
    </div>
  );
}
