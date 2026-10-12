import { useId, useMemo, useRef, useState } from "react";

export interface FinderOption {
  kind: "creator" | "stock";
  query: string;
  label: string;
  sub?: string;
}

// One search for both creators and stocks, with grouped suggestions and
// keyboard navigation. Anything not in the list can still be looked up.
export function Finder({ options, onPick }: { options: FinderOption[]; onPick: (o: FinderOption) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const hits = t ? options.filter((o) => o.label.toLowerCase().includes(t) || (o.sub ?? "").toLowerCase().includes(t)) : options;
    const free: FinderOption[] = t.length >= 2 && !hits.some((o) => o.label.toLowerCase() === t)
      ? [
          { kind: "creator", query: q.trim(), label: q.trim(), sub: "Look up as a YouTube creator" },
          { kind: "stock", query: q.trim(), label: q.trim(), sub: "Look up as a stock" },
        ]
      : [];
    return [...hits.slice(0, 8), ...free];
  }, [q, options]);

  const pick = (o: FinderOption) => {
    onPick(o);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="fd" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <svg className="fd-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Search a YouTube creator or a stock, e.g. Pranay Phulkar, Suzlon"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter" && results[cursor]) {
            pick(results[cursor]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <kbd className="fd-kbd">Enter</kbd>
      {open && results.length > 0 && (
        <ul className="fd-list" id={listId} role="listbox">
          {results.map((o, i) => {
            const first = i === 0 || results[i - 1].kind !== o.kind || (results[i - 1].sub?.startsWith("Look up") ?? false) !== (o.sub?.startsWith("Look up") ?? false);
            return (
              <li key={`${o.kind}:${o.query}:${o.sub}`} role="option" aria-selected={i === cursor}>
                {first && !o.sub?.startsWith("Look up") && <div className="fd-group">{o.kind === "creator" ? "Creators" : "Stocks"}</div>}
                {first && o.sub?.startsWith("Look up") && <div className="fd-group">Not audited yet</div>}
                <button tabIndex={-1} className={i === cursor ? "on" : ""} onMouseEnter={() => setCursor(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                  <span className={`fd-kind fd-kind-${o.kind}`}>{o.kind === "creator" ? "Creator" : "Stock"}</span>
                  <b>{o.label}</b>
                  {o.sub && <small>{o.sub}</small>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
