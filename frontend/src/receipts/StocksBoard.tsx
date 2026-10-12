import { useNavigate } from "react-router-dom";
import { stockPath } from "./data";
import { fmtDate, pct } from "./format";
import { Spark } from "./Spark";
import { ChevronRight } from "./Icons";
import { useQuotes, useStockIndex } from "./stocksData";

export function StocksTable({ filter = "" }: { filter?: string }) {
  const all = useStockIndex();
  const quotes = useQuotes((all ?? []).map((r) => r.yahoo).filter((s): s is string => !!s));
  const nav = useNavigate();
  if (!all) return <div className="lb-skel" />;
  const f = filter.trim().toLowerCase();
  const rows = f ? all.filter((r) => r.key.includes(f) || (r.gf ?? "").toLowerCase().includes(f)) : all;
  return (
    <div className="lb-wrap">
      <table className="lb st-table">
        <thead>
          <tr>
            <th>Stock</th>
            <th className="num">Price</th>
            <th className="num">Today</th>
            <th>6 months</th>
            <th className="num">Tips</th>
            <th>Named by</th>
            <th className="num">Avg month after tip</th>
            <th className="num">Last named</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const q = r.yahoo ? quotes[r.yahoo] : undefined;
            return (
              <tr key={r.key} className="row-link" onClick={() => nav(stockPath(r.query))} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav(stockPath(r.query))}>
                <td>
                  <b className="st-name">{r.name}</b>
                  <small className="tt-sym">{r.gf ?? "Not on NSE/BSE · not scored"}</small>
                </td>
                <td className="num">{q?.price != null ? `₹${q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : <span className="dim">–</span>}</td>
                <td className={`num ${q?.change_pct == null ? "dim" : q.change_pct >= 0 ? "up" : "down"}`}>{q?.change_pct == null ? "–" : pct(q.change_pct)}</td>
                <td>{q?.points?.length ? <Spark points={q.points} width={110} height={30} /> : <span className="dim">–</span>}</td>
                <td className="num">{r.tips.length || <span className="dim">–</span>}</td>
                <td className="st-by">{r.creators.length ? r.creators.join(", ") : r.videos ? `${r.videos} YouTube videos` : "–"}</td>
                <td className={`num ${r.avgRet == null ? "dim" : r.avgRet >= 0 ? "up" : "down"}`}>{r.avgRet == null ? "–" : pct(r.avgRet)}</td>
                <td className="num tt-date">{r.last ? fmtDate(r.last) : "–"}</td>
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
      {!rows.length && <p className="lb-note">No stock matches “{filter}”.</p>}
    </div>
  );
}
