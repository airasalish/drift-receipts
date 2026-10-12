import type { Claim } from "./claims";

// The speaker's own words always come first (they're the evidence); an English
// translation, when there is one, sits underneath and says so.
export function Quote({ c, className }: { c: Pick<Claim, "quote" | "quoteEn">; className?: string }) {
  return (
    <span className={`qt ${className ?? ""}`}>
      <span className="qt-orig">“{c.quote}”</span>
      {c.quoteEn && (
        <span className="qt-en" title="English translation">
          <i>EN</i> {c.quoteEn}
        </span>
      )}
    </span>
  );
}
