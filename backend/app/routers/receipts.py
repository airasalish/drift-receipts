"""Receipts API. Public (no login) on purpose: auditing a public YouTube
channel involves nothing user-specific, and judges/testers can try it
without an account. Spend is bounded by the SerpApi budget guard, not auth.
"""

import logging
import os
import time

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.receipts import audit, dashboard, live, sebi
from app.services.receipts import serpapi_client as serp
from app.services.receipts.extraction import AIUnavailable

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

DEMO_MISS = "This demo only shows saved results, and there's no saved result for that yet."


def _unavailable(exc: Exception) -> HTTPException:
    if serp._offline():
        return HTTPException(status_code=404, detail=DEMO_MISS)
    return HTTPException(status_code=503, detail=f"search data unavailable: {exc}")


@router.get("/budget")
def budget():
    """Credits this app has spent this month, plus SerpApi's own count when online."""
    return {"app": serp.usage(), "serpapi_account": serp.account(), "offline": serp._offline()}


@router.get("/live")
def live_feed():
    """Header bar: live Nifty 50 level plus Raseed's latest verdicts for the ticker."""
    return {"nifty": live.nifty(), "tape": live.tape()}


@router.get("/profile")
def profile(name: str = Query(min_length=2, max_length=80)):
    """Creator avatar, handle and subscribers, from the saved YouTube search."""
    return {"profile": dashboard.channel_profile(name)}


@router.get("/transcript")
def transcript(v: str = Query(min_length=6, max_length=20)):
    segs = dashboard.transcript(v)
    if segs is None:
        raise HTTPException(status_code=404, detail="No saved transcript for this video.")
    return {"video_id": v, "segments": segs}


@router.get("/series")
def series(gf: str | None = Query(None, max_length=40), yahoo: str | None = Query(None, max_length=40)):
    s = dashboard.saved_series(gf, yahoo)
    if s is None:
        raise HTTPException(status_code=404, detail="No price history available.")
    return s


@router.get("/watch")
def watch(symbols: str = Query(min_length=2, max_length=600)):
    """Watchlist rows for comma-separated Yahoo symbols (free data, no SerpApi)."""
    return {"rows": dashboard.watch([s.strip() for s in symbols.split(",") if s.strip()])}


@router.get("/chart")
def chart(symbol: str = Query(min_length=1, max_length=40), range: str = Query("6M", max_length=4)):
    """OHLC candles for the watchlist chart (Yahoo, free)."""
    data = dashboard.chart(symbol, range)
    if not data:
        raise HTTPException(status_code=404, detail="No chart data for this symbol and range.")
    return data


@router.get("/news")
def news(q: str = Query(min_length=2, max_length=80)):
    """Google News headlines via SerpApi, saved for a week."""
    return sebi.news(q)


@router.get("/sources")
def sources(video: str | None = Query(None, max_length=20), gf: str | None = Query(None, max_length=40),
            channel: str | None = Query(None, max_length=80)):
    """The saved SerpApi responses a tip was built from."""
    return {"sources": dashboard.sources(video, gf, channel)}


@router.get("/raw/{name}")
def raw(name: str):
    """One saved SerpApi response, as SerpApi returned it (archive links removed)."""
    data = dashboard.raw(name)
    if data is None:
        raise HTTPException(status_code=404, detail="No saved SerpApi response by that name.")
    return data


@router.get("/lookup")
def lookup(q: str = Query(min_length=2, max_length=60)):
    return {"results": dashboard.lookup(q)}


@router.get("/examples")
def examples():
    """Saved channels and stocks -- default suggestions and autocomplete."""
    return live.examples()


@router.get("/channel")
def channel_report(
    name: str = Query(min_length=2, max_length=80),
    max_videos: int = Query(4, ge=1, le=8),
    refresh: bool = False,
):
    try:
        return audit.audit_channel(name, max_videos=max_videos, refresh=refresh)
    except serp.BudgetExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except serp.SerpApiUnavailable as exc:
        raise _unavailable(exc)


# ---- live checks on the public site ----------------------------------------
# Browsing never spends searches. A live check is an explicit button press that
# may spend a handful (LIVE_MAX_CALLS), and only while the real SerpApi
# allowance stays above a reserve. One check per visitor every few minutes.
LIVE_MAX_CALLS = int(os.getenv("LIVE_MAX_CALLS", "6"))
LIVE_RESERVE = int(os.getenv("LIVE_RESERVE", "15"))
LIVE_COOLDOWN_S = int(os.getenv("LIVE_COOLDOWN_S", "180"))
_last_live: dict[str, float] = {}


@router.get("/live-status")
def live_status():
    """Whether live checks are switched on, so the UI can offer the button."""
    if not os.getenv("SERPAPI_API_KEY", "").strip() or not os.getenv("GROQ_API_KEYS", "").strip():
        return {"enabled": False, "local_only": True, "reason": "Live checks are switched off on this public demo, to protect the free search allowance."}
    acct = serp.account(force=True) or {}
    if not acct:
        return {"enabled": False, "reason": "Couldn't confirm the search allowance, so live checks are paused."}
    left = acct.get("total_searches_left")
    if left is not None and left < LIVE_RESERVE:
        return {"enabled": False, "reason": "This month's search allowance is nearly used up, so live checks are paused."}
    return {"enabled": True, "searches_per_check": LIVE_MAX_CALLS, "searches_left": left}


@router.get("/first-look")
def first_look(name: str = Query(min_length=2, max_length=80)):
    """Free: what the AI already knows about a YouTuber, before any search is spent."""
    from app.services.receipts import profile_ai

    if not os.getenv("GROQ_API_KEYS", "").strip():
        return {"available": False}
    info = profile_ai.look_up(name)
    return {"available": True, **info, "skip_search": profile_ai.skip_search(info)}


@router.get("/live-check")
def live_check(request: Request, name: str = Query(min_length=2, max_length=80)):
    status = live_status()
    if not status["enabled"]:
        raise HTTPException(status_code=503, detail=status["reason"])
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    wait = LIVE_COOLDOWN_S - (now - _last_live.get(ip, 0))
    if wait > 0:
        raise HTTPException(status_code=429, detail=f"One live check every few minutes, please. Try again in {int(wait // 60) + 1} min.")
    _last_live[ip] = now
    try:
        with serp.live_mode(LIVE_MAX_CALLS, free_prices=True):
            report = audit.audit_channel(name, max_videos=2, live=True)
    except serp.BudgetExceeded:
        raise HTTPException(status_code=429, detail="Live checks have used this month's search allowance. They'll be back when it resets.")
    except AIUnavailable as exc:
        _last_live.pop(ip, None)  # not the visitor's fault: let them retry
        raise HTTPException(status_code=503, detail=str(exc))
    except serp.SerpApiUnavailable as exc:
        raise _unavailable(exc)
    return report


@router.get("/hype")
def hype(company: str = Query(min_length=2, max_length=80), refresh: bool = False):
    try:
        return audit.hype_check(company, refresh=refresh)
    except serp.BudgetExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except serp.SerpApiUnavailable as exc:
        raise _unavailable(exc)


@router.get("/case/sebi-sadhna")
def sebi_case():
    try:
        return audit.sebi_case_study()
    except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
        raise _unavailable(exc)
