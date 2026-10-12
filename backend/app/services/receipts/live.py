"""The two 'live' feeds on the Receipts site.

- nifty(): the current Nifty 50 level from Yahoo Finance (free, no SerpApi
  credits), cached for a minute so a busy page can't hammer Yahoo.
- tape(): the latest verdicts from saved reports, for the scrolling
  ticker. Stocks and outcomes only -- never the channel's name.
"""

import json
import logging
import time

from app.services.receipts import yahoo

from app.services.receipts import audit

logger = logging.getLogger(__name__)

_NIFTY_TTL_S = 60
_nifty_cache: tuple[float, dict | None] = (0.0, None)


def nifty() -> dict | None:
    global _nifty_cache
    fetched, cached = _nifty_cache
    if cached is not None and time.time() - fetched < _NIFTY_TTL_S:
        return cached
    try:
        intraday = yahoo.history("^NSEI", range_="5d", interval="5m")
        daily = yahoo.history("^NSEI", range_="1mo", interval="1d")
        if not intraday or len(daily) < 2:
            raise ValueError("no Nifty data")
        last_ts = intraday[-1]["ts"]
        price = intraday[-1]["close"]
        # previous session's close = last daily close before the latest bar's date
        prev_days = [b for b in daily if b["ts"].date() < last_ts.date()]
        prev_close = prev_days[-1]["close"] if prev_days else daily[-2]["close"]
        out = {
            "price": round(price, 2),
            "change": round(price - prev_close, 2),
            "change_pct": round((price - prev_close) / prev_close * 100, 2),
            "as_of": last_ts.isoformat(),
            "source": "Yahoo Finance",
        }
    except Exception as exc:  # Yahoo can rate-limit cloud IPs; the bar just hides the number
        logger.warning("nifty fetch failed: %s", type(exc).__name__)
        out = cached
    _nifty_cache = (time.time(), out)
    return out


def examples() -> dict:
    """Saved channels and stocks, for the search boxes' defaults and autocomplete.
    `query` is what to send back to load the saved result (reports are keyed by
    the original query, so it's rebuilt from the file name's slug)."""
    channels, stocks = [], []
    for path in sorted(audit.REPORTS_DIR.glob("channel_*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        picks = [c for c in r.get("calls", []) if c.get("direction") != "watch"]
        if r.get("status") == "ok" and picks:
            channels.append({"query": r["channel"], "label": r["channel"], "videos": len(r.get("videos", [])), "picks": len(picks)})
    for path in sorted(audit.REPORTS_DIR.glob("hype_*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        if not r.get("videos"):
            continue
        stocks.append({
            "query": path.stem.removeprefix("hype_").replace("-", " "),
            "label": r.get("company"),
            "ticker": (r.get("ticker") or {}).get("google_finance"),
            "videos": len(r.get("videos", [])),
        })
    return {"channels": sorted(channels, key=lambda c: -c["picks"]), "stocks": stocks}


def tape(limit: int = 12) -> list[dict]:
    items: list[dict] = []
    try:
        case = audit.sebi_case_study()
        m = case["pump_check"]["metrics"]
        items.append({
            "kind": "pump",
            "stock": "SADHNA BROADCAST",
            "text": f"₹{round(m['peak_price'])} → ₹{round(m['trough_after_peak'])}",
            "change_pct": -float(m["drawdown_from_peak_pct"]),
            "verdict": "PUMP & DUMP ⚠",
            "good": False,
            "date": m["trough_date"],
        })
    except Exception as exc:
        logger.warning("tape: SEBI case unavailable: %s", type(exc).__name__)

    for path in sorted(audit.REPORTS_DIR.glob("channel_*.json")):
        report = json.loads(path.read_text(encoding="utf-8"))
        for c in report.get("calls", []):
            h = (c.get("score") or {}).get("horizons", {}).get("30", {})
            if h.get("status") != "done" or not c.get("ticker"):
                continue
            good = c["score"]["outcome"] in ("beat_market", "lagged_market_as_called")
            items.append({
                "kind": "tip",
                "stock": c["ticker"]["name"].upper().replace(" LIMITED", "").replace(" LTD", ""),
                "change_pct": h["stock_return_pct"],
                "market_pct": h.get("nifty_return_pct"),
                # "beat the market", not "good tip": a stock can fall 4% and still beat a market that fell 5%
                "verdict": "BETTER THAN MARKET ✓" if good else "WORSE THAN MARKET ✗",
                "good": good,
                "date": c.get("call_date"),
            })
    return items[:limit]
