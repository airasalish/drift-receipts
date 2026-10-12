"""Read-side helpers for the investigation dashboard.

Nothing here spends SerpApi credits: it reads results already saved by
audits (search pages, transcripts, Google Finance series) and falls back to
free Yahoo data for prices and listing search.
"""

import datetime
import functools
import re
import json
import logging

from app.services.receipts import yahoo

from app.services.receipts import audit, prices, tickers
from app.services.receipts import serpapi_client as serp

logger = logging.getLogger(__name__)


def _cached(params: dict) -> dict | None:
    path = serp._cache_path(params)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def channel_profile(channel: str) -> dict | None:
    """Avatar, handle and subscriber count from the YouTube search the audit already ran."""
    data = _cached({"engine": "youtube", "search_query": f"{channel} stocks", "gl": "in", "hl": "en"})
    if not data:
        return None
    want = channel.strip().lower()
    for c in data.get("channel_results", []) or []:
        if want in (c.get("title") or "").lower():
            return {k: c.get(k) for k in ("title", "handle", "subscribers", "thumbnail", "link", "verified", "description")}
    for v in data.get("video_results", []) or []:
        ch = v.get("channel") or {}
        if want in (ch.get("name") or "").lower():
            return {"title": ch.get("name"), "thumbnail": ch.get("thumbnail"), "link": ch.get("link"), "verified": ch.get("verified")}
    return None


def transcript(video_id: str) -> list[dict] | None:
    data = _cached({"engine": "youtube_video_transcript", "v": video_id})
    if data is None:
        return None
    return [{"start_s": round((s.get("start_ms") or 0) / 1000), "text": (s.get("snippet") or "").strip()}
            for s in data.get("transcript", []) if (s.get("snippet") or "").strip()]


def saved_series(gf_symbol: str | None, yahoo_symbol: str | None) -> dict | None:
    """The widest Google Finance series saved for this symbol; Yahoo (free) if none."""
    best = None
    if gf_symbol:
        for path in serp.CACHE_DIR.glob("google_finance_*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("search_parameters", {}).get("q") != gf_symbol:
                continue
            points = []
            for p in data.get("graph", []) or []:
                d = prices._parse_gf_date(str(p.get("date", "")))
                if d and p.get("price") is not None:
                    points.append({"date": d.isoformat(), "price": float(p["price"]), "volume": p.get("volume")})
            if points and (best is None or len(points) > len(best["points"])):
                best = {"source": "google_finance", "symbol": gf_symbol,
                        "window": data["search_parameters"].get("window"), "points": points}
    if best:
        return best
    if yahoo_symbol:
        s = prices.yahoo_series(yahoo_symbol, datetime.date.today() - datetime.timedelta(days=180))
        if s["points"]:
            return {"source": "yahoo", "symbol": yahoo_symbol, "window": "6M", "points": s["points"]}
    return None


def mentions_of(yahoo_symbol: str) -> list[dict]:
    """Every saved moment where an audited creator, or a mapped stock video, named this stock."""
    out = []
    for path in audit.REPORTS_DIR.glob("channel_*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        for c in r.get("calls", []):
            if (c.get("ticker") or {}).get("yahoo_symbol") == yahoo_symbol:
                out.append({"channel": r["channel"], "video_title": c["video_title"], "video_id": c["video_id"],
                            "date": c.get("call_date"), "direction": c["direction"], "quote": c["quote"],
                            "timestamp_url": c["timestamp_url"], "outcome": (c.get("score") or {}).get("outcome")})
    for path in audit.REPORTS_DIR.glob("hype_*.json"):
        r = json.loads(path.read_text(encoding="utf-8"))
        if (r.get("ticker") or {}).get("yahoo_symbol") != yahoo_symbol:
            continue
        for v in r.get("videos", []):
            for m in v.get("mentions") or []:
                out.append({"channel": v.get("channel"), "video_title": v["title"], "video_id": v["video_id"],
                            "date": v.get("published_date"), "direction": m["direction"], "quote": m["quote"],
                            "timestamp_url": m["timestamp_url"], "outcome": None})
    return sorted(out, key=lambda m: m.get("date") or "", reverse=True)


# Watchlist's attention rules (services/change_detection.py), same thresholds,
# re-stated here because the original reads database rows.
MIN_MOVE, MOVE_SENSITIVITY, DAY_FLOOR = 0.01, 1.5, 0.02
VOLUME_SPIKE, NEAR_52W = 2.0, 0.03


def unusual_signals(price, prev_close, volume, avg_volume_20d, avg_move_20d, high52, low52) -> list[dict]:
    out = []
    if price and prev_close:
        day = (price - prev_close) / prev_close
        threshold = max(DAY_FLOOR, max(MIN_MOVE, (avg_move_20d or 0) * MOVE_SENSITIVITY))
        if abs(day) >= threshold:
            usual = f", vs its usual ±{avg_move_20d * 100:.1f}%" if avg_move_20d else ""
            out.append({"rule": "price_move", "tone": "up" if day > 0 else "down",
                        "message": f"{'Up' if day > 0 else 'Down'} {abs(day) * 100:.1f}% today{usual}"})
    if volume and avg_volume_20d and volume / avg_volume_20d >= VOLUME_SPIKE:
        out.append({"rule": "unusual_volume", "tone": "warn",
                    "message": f"Volume {volume / avg_volume_20d:.1f}× its 20-day average"})
    if price and high52:
        if price >= high52:
            out.append({"rule": "week52_high", "tone": "up", "message": "At a new 52-week high"})
        elif price >= high52 * (1 - NEAR_52W):
            out.append({"rule": "week52_high", "tone": "up", "message": f"Within {(high52 - price) / high52 * 100:.1f}% of its 52-week high"})
    if price and low52:
        if price <= low52:
            out.append({"rule": "week52_low", "tone": "down", "message": "At a new 52-week low"})
        elif price <= low52 * (1 + NEAR_52W):
            out.append({"rule": "week52_low", "tone": "down", "message": f"Within {(price - low52) / low52 * 100:.1f}% of its 52-week low"})
    return out


def watch(yahoo_symbols: list[str]) -> list[dict]:
    """Watchlist rows: price, day move, 6-month line, Watchlist's signals, 52-week
    range, and which audited creators have talked about the stock. One free
    Yahoo request per symbol."""
    rows = []
    for sym in yahoo_symbols[:30]:
        row = {"symbol": sym, "price": None, "change_pct": None, "points": [], "signals": [], "stats": None,
               "mentions": mentions_of(sym)}
        try:
            h = yahoo.history(sym, range_="1y", interval="1d")
            if len(h) >= 2:
                price, prev = h[-1]["close"], h[-2]["close"]
                trailing = h[-21:-1]
                moves = [abs(b["close"] / a["close"] - 1) for a, b in zip(trailing, trailing[1:]) if a["close"]]
                avg_move = sum(moves) / len(moves) if moves else 0.0
                vols = [b["volume"] for b in trailing if b["volume"] is not None]
                avg_vol = sum(vols) / len(vols) if vols else None
                high52 = max(b["high"] if b["high"] is not None else b["close"] for b in h)
                low52 = min(b["low"] if b["low"] is not None else b["close"] for b in h)
                cutoff = h[-1]["ts"] - datetime.timedelta(days=183)
                last_vol = h[-1]["volume"] or 0.0
                row.update({
                    "price": round(price, 2),
                    "change_pct": round((price - prev) / prev * 100, 2),
                    "points": [{"date": b["date"], "price": round(b["close"], 2)} for b in h if b["ts"] >= cutoff],
                    "signals": unusual_signals(price, prev, last_vol, avg_vol, avg_move, high52, low52),
                    "stats": {"week52_high": round(high52, 2), "week52_low": round(low52, 2),
                              "avg_daily_move_pct": round(avg_move * 100, 2),
                              "volume": last_vol, "avg_volume_20d": avg_vol},
                })
        except Exception as exc:
            logger.warning("watch: %s failed: %s", sym, type(exc).__name__)
        rows.append(row)
    return rows


def lookup(query: str) -> list[dict]:
    """Indian equities matching a name or symbol (Yahoo listing search, free)."""
    out = []
    for q in tickers._search(query.strip()):
        sym = str(q.get("symbol", ""))
        if q.get("quoteType") == "EQUITY" and sym.upper().endswith((".NS", ".BO")):
            out.append({"yahoo_symbol": sym, "google_finance": tickers.to_google_finance(sym),
                        "name": q.get("longname") or q.get("shortname") or sym,
                        "exchange": "NSE" if sym.upper().endswith(".NS") else "BSE"})
    return out[:8]


_CHART_RANGES = {"1D": ("1d", "5m"), "5D": ("5d", "15m"), "1M": ("1mo", "1d"), "3M": ("3mo", "1d"), "6M": ("6mo", "1d"),
                 "YTD": ("ytd", "1d"), "1Y": ("1y", "1d"), "5Y": ("5y", "1wk"), "ALL": ("max", "1mo")}


def chart(symbol: str, range_name: str) -> dict | None:
    """OHLC bars in the shape Watchlist's chart panel reads (free Yahoo data)."""
    if range_name not in _CHART_RANGES:
        return None
    rng, interval = _CHART_RANGES[range_name]
    bars = yahoo.history(symbol, range_=rng, interval=interval)
    if not bars:
        return None
    intraday = interval.endswith("m")
    return {
        "symbol": symbol,
        "range": range_name,
        "dates": [b["ts"].isoformat() if intraday else b["date"] for b in bars],
        "closes": [b["close"] for b in bars],
        "opens": [b["open"] for b in bars],
        "highs": [b["high"] for b in bars],
        "lows": [b["low"] for b in bars],
        "volumes": [b["volume"] for b in bars],
        "currency": "INR" if symbol.upper().endswith((".NS", ".BO")) or symbol.startswith("^NSE") else None,
    }


# ---- the SerpApi responses behind a tip, for the public "raw data" view ----
_RAW_NAME = re.compile(r"^(youtube|youtube_video|youtube_video_transcript|google|google_finance|google_news)_[0-9a-f]{12}\.json$")
_LABELS = {
    "youtube": "YouTube search",
    "youtube_video_transcript": "YouTube video transcript",
    "google_finance": "Google Finance prices",
}


@functools.lru_cache(maxsize=1)
def _cache_index() -> dict:
    """search parameters -> saved response file, for the engines a tip uses."""
    idx: dict = {"transcript": {}, "finance": {}, "youtube": {}}
    for path in serp.CACHE_DIR.glob("*.json"):
        if not _RAW_NAME.match(path.name):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        prm = data.get("search_parameters") or {}
        meta = data.get("search_metadata") or {}
        entry = {"file": path.name, "engine": prm.get("engine"), "params": {k: v for k, v in prm.items() if k not in ("api_key",)},
                 "search_id": meta.get("id"), "created_at": meta.get("created_at")}
        if prm.get("engine") == "youtube_video_transcript" and prm.get("v"):
            idx["transcript"][prm["v"]] = entry
        elif prm.get("engine") == "google_finance" and prm.get("q"):
            idx["finance"].setdefault(prm["q"], []).append(entry)
        elif prm.get("engine") == "youtube" and prm.get("search_query"):
            idx["youtube"][prm["search_query"].lower()] = entry
    return idx


def sources(video_id: str | None, gf: str | None, channel: str | None) -> list[dict]:
    idx = _cache_index()
    out = []
    if channel and (e := idx["youtube"].get(f"{channel} stocks".lower())):
        out.append({**e, "label": "Found the video", "why": f"YouTube search for \"{channel} stocks\""})
    if video_id and (e := idx["transcript"].get(video_id)):
        out.append({**e, "label": "Read the transcript", "why": "Every line of the video, with timestamps; the quote is checked against this"})
    order = {"1M": 0, "6M": 1, "1Y": 2, "5Y": 3, "MAX": 4}
    for q, why in ((gf, "Daily prices used for the video day and a month later"), (prices.NIFTY_GF, "The Nifty 50 over the same days")):
        files = sorted(idx["finance"].get(q or "", []), key=lambda e: order.get(str(e["params"].get("window")), 9))
        if files:
            out.append({**files[-1], "label": "Priced the stock" if q == gf else "Priced the market", "why": why})
    for e in out:
        e["engine_label"] = _LABELS.get(e["engine"], e["engine"])
    return out


def raw(name: str) -> dict | None:
    """One saved SerpApi response, minus SerpApi's own archive links."""
    if not _RAW_NAME.match(name):
        return None
    path = serp.CACHE_DIR / name
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    meta = data.get("search_metadata") or {}
    for k in ("json_endpoint", "raw_html_file", "prettify_html_file"):
        meta.pop(k, None)
    data.pop("_fetched_at", None)
    return data
