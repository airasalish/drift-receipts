"""The only place this app talks to SerpApi.

Three guarantees, all because the free plan is 250 searches a month:

- **Cache first.** Every response is written to data/serpapi_cache/ keyed by
  its exact parameters. Transcripts and historical prices don't change, so
  most lookups are paid for once, ever. Live-ish lookups (search results,
  current quotes) pass max_age_hours so they refresh, but never more than
  that.
- **Hard budget.** A month-scoped counter in data/serpapi_usage.json stops
  real calls at SERPAPI_MONTHLY_BUDGET (default 200, leaving headroom for
  manual testing on the dashboard). Hitting the cap raises BudgetExceeded --
  callers degrade to "not checked", they never silently invent data.
- **Offline mode.** SERPAPI_OFFLINE=1 serves the cache only and never touches
  the network. The cache is committed to the repo, so anyone can run the demo
  without a key or spending a single credit.

The API key is never written into a cached response or a log line.
"""

import contextlib
import contextvars
import datetime
import hashlib
import tempfile
import json
import logging
import os
import pathlib
import threading

import requests

logger = logging.getLogger(__name__)

DATA_DIR = pathlib.Path(__file__).resolve().parents[3] / "data"
CACHE_DIR = DATA_DIR / "serpapi_cache"
USAGE_FILE = DATA_DIR / "serpapi_usage.json"
# where new results go when the bundled data folder is read-only (Vercel)
TMP_CACHE_DIR = pathlib.Path(tempfile.gettempdir()) / "receipts_serpapi_cache"
ENDPOINT = "https://serpapi.com/search.json"

_lock = threading.Lock()


class BudgetExceeded(RuntimeError):
    pass


class SerpApiUnavailable(RuntimeError):
    """No key, offline mode with a cache miss, or a network/API failure."""


def _budget() -> int:
    return int(os.getenv("SERPAPI_MONTHLY_BUDGET", "200"))


# A live check is one request that may spend a few real searches even though
# the site otherwise runs offline. The cap lives in a context variable so it
# applies to that request only.
_live: contextvars.ContextVar[dict | None] = contextvars.ContextVar("receipts_live", default=None)


@contextlib.contextmanager
def live_mode(max_calls: int, free_prices: bool = True):
    token = _live.set({"max_calls": max_calls, "used": 0, "free_prices": free_prices})
    try:
        yield _live.get()
    finally:
        _live.reset(token)


def live_state() -> dict | None:
    return _live.get()


def _offline() -> bool:
    if _live.get() is not None:
        return False
    return os.getenv("SERPAPI_OFFLINE", "").strip().lower() in {"1", "true", "yes"}


def _cache_path(params: dict) -> pathlib.Path:
    # same naming scheme as scripts/feasibility.py, so its cached responses are reused
    tag = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()[:12]
    name = f"{params['engine']}_{tag}.json"
    bundled = CACHE_DIR / name
    tmp = TMP_CACHE_DIR / name
    return tmp if not bundled.exists() and tmp.exists() else bundled


def _month() -> str:
    return datetime.date.today().strftime("%Y-%m")


def usage() -> dict:
    """Real calls made this month by this app (cache hits are free and not counted)."""
    try:
        data = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    used = data.get(_month(), 0)
    return {"month": _month(), "used": used, "budget": _budget(), "remaining": max(0, _budget() - used)}


def _record_call() -> None:
    try:
        data = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    data[_month()] = data.get(_month(), 0) + 1
    try:
        USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        USAGE_FILE.write_text(json.dumps(data, indent=1), encoding="utf-8")
    except OSError:  # read-only filesystem: the per-request live cap still applies
        pass


def search(params: dict, max_age_hours: float | None = None) -> dict:
    """Run one SerpApi search, cache-first.

    max_age_hours=None means the cached copy never expires (transcripts,
    historical prices). A stale cache entry is still returned as a fallback
    if a refresh isn't possible (offline, over budget, network down) -- with
    `_cache_stale: True` set so the UI can say so instead of passing it off
    as fresh.
    """
    path = _cache_path(params)
    cached = None
    if path.exists():
        cached = json.loads(path.read_text(encoding="utf-8"))
        fetched = cached.get("_fetched_at")
        if max_age_hours is None or not fetched:
            return cached
        age = datetime.datetime.utcnow() - datetime.datetime.fromisoformat(fetched)
        if age <= datetime.timedelta(hours=max_age_hours):
            return cached

    def stale_or_raise(exc: Exception):
        if cached is not None:
            return {**cached, "_cache_stale": True}
        raise exc

    if _offline():
        return stale_or_raise(SerpApiUnavailable(f"offline mode and no cached {params['engine']} result"))
    key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not key:
        return stale_or_raise(SerpApiUnavailable("SERPAPI_API_KEY is not set"))

    with _lock:
        live = _live.get()
        if live is not None and live["used"] >= live["max_calls"]:
            return stale_or_raise(BudgetExceeded("this live check has used its searches"))
        # a live check is gated by SerpApi's own balance (checked before it
        # starts) and its per-check cap, not by this machine's local counter
        if live is None and usage()["remaining"] <= 0:
            return stale_or_raise(BudgetExceeded(f"monthly SerpApi budget of {_budget()} reached"))
        if live is not None:
            live["used"] += 1
        try:
            resp = requests.get(ENDPOINT, params={**params, "api_key": key}, timeout=90)
            data = resp.json()
        except Exception as exc:
            logger.warning("serpapi %s request failed: %s", params.get("engine"), type(exc).__name__)
            return stale_or_raise(SerpApiUnavailable("SerpApi request failed"))
        _record_call()

    if "error" in data:
        # SerpApi reports "no results" as an error too -- that's a real answer
        # worth caching (so we don't pay to ask again), anything else isn't
        if "hasn't returned any results" not in data["error"]:
            logger.warning("serpapi %s error: %s", params.get("engine"), data["error"])
            return stale_or_raise(SerpApiUnavailable(data["error"]))

    data["_fetched_at"] = datetime.datetime.utcnow().isoformat(timespec="seconds")
    body = json.dumps(data, indent=1, ensure_ascii=False)
    for target in (CACHE_DIR / path.name, TMP_CACHE_DIR / path.name):
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8")
            break
        except OSError:
            continue
    return data


def account(force: bool = False) -> dict | None:
    """SerpApi's own view of the plan (this endpoint is free, uses no searches).
    `force` asks even in offline mode -- the live-check guard needs the real balance."""
    key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not key or (_offline() and not force):
        return None
    try:
        d = requests.get("https://serpapi.com/account.json", params={"api_key": key}, timeout=20).json()
    except Exception:
        return None
    return {k: d.get(k) for k in ("plan_name", "searches_per_month", "this_month_usage", "total_searches_left")}
