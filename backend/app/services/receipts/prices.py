"""Price + volume history for scoring calls, from Google Finance via SerpApi.

Google Finance is the primary source on purpose: it covers small BSE-only
stocks that Yahoo has no data for at all -- exactly the illiquid names
pump-and-dump schemes use (Sadhna Broadcast, the SEBI case this app is
validated on, returns nothing from Yahoo but a full 5-year weekly series
from Google Finance). Yahoo is a fallback only when SerpApi can't be used,
and every series says which source it came from.

One request per ticker per window, cached for a day: all calls on the same
stock share one lookup. The window is the smallest one covering the oldest
call (1M < 6M < 1Y < 5Y < MAX), since smaller windows are denser.
"""

import datetime
import logging

from app.services.receipts import yahoo

from app.services.receipts import serpapi_client as serp

logger = logging.getLogger(__name__)

NIFTY_GF = "NIFTY_50:INDEXNSE"
NIFTY_YAHOO = "^NSEI"
_WINDOWS = [("1M", 28), ("6M", 175), ("1Y", 360), ("5Y", 5 * 365 - 10), ("MAX", 10 ** 6)]


def window_for(since: datetime.date, today: datetime.date | None = None) -> str:
    # +100 days so the 90-day horizon after the call is also inside the window
    age = ((today or datetime.date.today()) - since).days + 5
    for name, max_days in _WINDOWS:
        if age <= max_days:
            return name
    return "MAX"


def _parse_gf_date(text: str) -> datetime.date | None:
    for fmt in ("%b %d %Y, %I:%M %p", "%b %d %Y"):
        try:
            return datetime.datetime.strptime(text.split(" UTC")[0].strip(), fmt).date()
        except ValueError:
            continue
    return None


def google_finance_series(gf_symbol: str, window: str) -> dict:
    data = serp.search({"engine": "google_finance", "q": gf_symbol, "window": window, "hl": "en"}, max_age_hours=24)
    points = []
    for p in data.get("graph", []) or []:
        d = _parse_gf_date(str(p.get("date", "")))
        if d and p.get("price") is not None:
            points.append({"date": d.isoformat(), "price": float(p["price"]), "volume": p.get("volume")})
    summary = data.get("summary") or {}
    return {
        "source": "google_finance",
        "symbol": gf_symbol,
        "window": window,
        "name": summary.get("title"),
        "currency": summary.get("currency") or (data.get("graph") or [{}])[0].get("currency"),
        "points": points,
        "stale": bool(data.get("_cache_stale")),
    }


def yahoo_series(yahoo_symbol: str, since: datetime.date) -> dict:
    bars = yahoo.history(yahoo_symbol, start=since - datetime.timedelta(days=60))
    points = [{"date": b["date"], "price": b["close"], "volume": b["volume"]} for b in bars]
    return {"source": "yahoo", "symbol": yahoo_symbol, "window": None, "name": None, "currency": "INR",
            "points": points, "stale": False}


def series(gf_symbol: str | None, yahoo_symbol: str | None, since: datetime.date) -> dict | None:
    """Google Finance first; Yahoo only if SerpApi is unavailable or over budget,
    or during a live check, where searches are saved for transcripts."""
    live = serp.live_state()
    if gf_symbol and not (live and live.get("free_prices")):
        try:
            s = google_finance_series(gf_symbol, window_for(since))
            if s["points"]:
                return s
        except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
            logger.info("google finance unavailable for %s (%s), trying yahoo", gf_symbol, exc)
    if yahoo_symbol:
        s = yahoo_series(yahoo_symbol, since)
        if s["points"]:
            return s
    return None


def benchmark(since: datetime.date) -> dict | None:
    return series(NIFTY_GF, NIFTY_YAHOO, since)


def price_on_or_after(points: list[dict], day: datetime.date, max_gap_days: int = 10) -> dict | None:
    """First data point on/after `day` -- a call made on a weekend or holiday is
    entered at the next trading price, never at a price from before the call."""
    iso = day.isoformat()
    for p in points:
        if p["date"] >= iso:
            gap = (datetime.date.fromisoformat(p["date"]) - day).days
            return p if gap <= max_gap_days else None
    return None
