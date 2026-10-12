"""Yahoo Finance over plain HTTP: price history and listing search.

Replaces yfinance (and with it pandas and numpy) on the serverless function.
Those libraries made up most of a ~225 MB bundle and most of every cold
start, just to read two JSON endpoints. Free, no key; SerpApi stays the
primary source for scoring prices.
"""
import datetime
import functools
import logging

import requests

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/json",
}
_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search"


def history(symbol: str, *, range_: str | None = "1y", interval: str = "1d",
            start: datetime.date | None = None, end: datetime.date | None = None) -> list[dict]:
    """Bars oldest-first: {"ts", "date", "open", "high", "low", "close", "volume"}.

    `ts` is the bar time in the exchange's local time, `date` its ISO day.
    Bars without a close are dropped. Returns [] on any failure.
    """
    params: dict = {"interval": interval, "includePrePost": "false", "events": "div,splits"}
    if start:
        params["period1"] = int(datetime.datetime.combine(start, datetime.time()).replace(tzinfo=datetime.timezone.utc).timestamp())
        params["period2"] = int(datetime.datetime.combine(end or datetime.date.today() + datetime.timedelta(days=1), datetime.time())
                                .replace(tzinfo=datetime.timezone.utc).timestamp())
    else:
        params["range"] = range_ or "1y"
    try:
        r = requests.get(_CHART.format(symbol=requests.utils.quote(symbol)), params=params, headers=_HEADERS, timeout=20)
        res = (r.json().get("chart") or {}).get("result") or []
    except Exception as exc:
        logger.warning("yahoo history %s failed: %s", symbol, type(exc).__name__)
        return []
    if not res:
        return []
    res = res[0]
    offset = (res.get("meta") or {}).get("gmtoffset") or 0
    q = ((res.get("indicators") or {}).get("quote") or [{}])[0]
    bars = []
    for i, ts in enumerate(res.get("timestamp") or []):
        close = (q.get("close") or [None])[i] if i < len(q.get("close") or []) else None
        if close is None:
            continue
        local = datetime.datetime.fromtimestamp(ts + offset, tz=datetime.timezone.utc).replace(tzinfo=None)

        def val(k):
            arr = q.get(k) or []
            v = arr[i] if i < len(arr) else None
            return float(v) if v is not None else None

        bars.append({"ts": local, "date": local.date().isoformat(), "open": val("open"), "high": val("high"),
                     "low": val("low"), "close": float(close), "volume": val("volume")})
    return bars


@functools.lru_cache(maxsize=512)
def search(query: str, n: int = 8) -> tuple:
    """Listing search, shaped like yfinance's Search.quotes (symbol, quoteType, longname, shortname)."""
    try:
        r = requests.get(_SEARCH, params={"q": query, "quotesCount": n, "newsCount": 0, "listsCount": 0},
                         headers=_HEADERS, timeout=20)
        return tuple(r.json().get("quotes") or [])
    except Exception as exc:
        logger.warning("yahoo search %r failed: %s", query, type(exc).__name__)
        return ()
