"""Finding a channel's videos and pulling their transcripts through SerpApi.

Upload dates matter more than anything else here: a stock call is scored
from the price *on the day it was made*. YouTube search only gives relative
dates ("2w ago", "1y ago"). Recent ones are precise enough as-is; anything
coarser than a week costs one extra youtube_video lookup for the exact date
-- paid once, then cached forever, and skipped entirely when the budget is
tight (the call is then marked date-approximate rather than guessed at).
"""

import datetime
import logging
import re

from app.services.receipts import serpapi_client as serp

logger = logging.getLogger(__name__)

_REL = re.compile(r"(\d+)\s*(second|minute|hour|day|week|month|year|min|hr|s|m|h|d|w|mo|y)s?\b", re.I)
_UNIT_DAYS = {"second": 0, "minute": 0, "hour": 0, "min": 0, "hr": 0, "s": 0, "m": 0, "h": 0,
              "day": 1, "d": 1, "week": 7, "w": 7, "month": 30, "mo": 30, "year": 365, "y": 365}


def parse_relative_date(text: str | None, today: datetime.date | None = None) -> tuple[datetime.date | None, int]:
    """'2w ago' -> (date ~14 days back, uncertainty in days). Uncertainty is
    half a unit, so '3 months ago' is honestly reported as +-15 days."""
    if not text:
        return None, 9999
    today = today or datetime.date.today()
    m = _REL.search(text.replace("Streamed", ""))
    if not m:
        return None, 9999
    n, unit = int(m.group(1)), m.group(2).lower()
    days = _UNIT_DAYS.get(unit, 0)
    return today - datetime.timedelta(days=n * days), max(0, days // 2)


def _parse_exact_date(text: str | None) -> datetime.date | None:
    if not text:
        return None
    text = re.sub(r"^(Streamed live on|Premiered)\s+", "", text.strip())
    for fmt in ("%b %d, %Y", "%d %b %Y", "%Y-%m-%d", "%B %d, %Y"):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def pick_scoreable(videos: list[dict], n: int, min_age_days: int = 35,
                   today: datetime.date | None = None) -> list[dict]:
    """Prefer videos old enough to have a 30-day result (oldest-qualifying
    first is NOT used -- we want the most recent *scoreable* track record),
    then fill with newer ones, which will show as pending."""
    today = today or datetime.date.today()

    def age(v):
        return (today - datetime.date.fromisoformat(v["published_date"])).days if v.get("published_date") else -1

    # "1mo ago" could be 45 days -- count it as possibly old enough (the exact date is fetched next)
    old = sorted((v for v in videos if age(v) + min(v.get("date_uncertainty_days", 0), 60) >= min_age_days), key=age)
    new = sorted((v for v in videos if v not in old and age(v) >= 0), key=age)
    return (old + new)[:n]


_TIP_TITLE = re.compile(r"stocks? to buy|best stocks?|multibagger|buy now|stocks? for|stocks? from|top \d+ stocks?|\d+ stocks?|portfolio|target", re.I)


def rank_for_tips(videos: list[dict]) -> list[dict]:
    """For a quick live check: videos whose titles promise stock picks first,
    then older ones (scoreable) before newer ones."""
    def score(v):
        title = v.get("title") or ""
        return 0 if _TIP_TITLE.search(title) else 1
    old_first = pick_scoreable(videos, len(videos))
    return sorted(old_first, key=score)


def _compact(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def channel_videos(channel: str, limit: int = 8, picks_first: bool = False) -> list[dict]:
    """Stock videos from one channel, via one YouTube search (two at most).

    Searching the channel's name plus 'stocks' and keeping only results whose
    channel matches is cheaper (1 credit) than paging through a channel
    feed, and naturally prefers the stock-tip videos we care about. If none
    of the results are from that channel, one more search on the name alone.
    """
    want = _compact(channel.strip().lstrip("@"))

    def matching(data: dict) -> list[dict]:
        out = []
        for v in data.get("video_results", []):
            ch = v.get("channel") or {}
            name, link = _compact(ch.get("name") or ""), (ch.get("link") or "").lower()
            if want and (want in name or f"@{want}" in _compact(link).replace("youtubecom", "@") or want in _compact(link)):
                out.append(_video(v))
                if len(out) >= limit:
                    break
        return out

    # a live check looks for the creator's "stocks to buy" videos first: those are the ones with tips
    first = f"{channel} stocks to buy" if picks_first else f"{channel} stocks"
    found = matching(serp.search({"engine": "youtube", "search_query": first, "gl": "in", "hl": "en"},
                                 max_age_hours=72))
    if not found:
        try:
            found = matching(serp.search({"engine": "youtube", "search_query": channel, "gl": "in", "hl": "en"},
                                         max_age_hours=72))
        except (serp.BudgetExceeded, serp.SerpApiUnavailable):
            pass
    return found


def channel_suggestions(channel: str, n: int = 5) -> list[str]:
    """Channel names YouTube returned for this name (from searches already made, so free)."""
    names: list[str] = []
    for q in (f"{channel} stocks to buy", f"{channel} stocks", channel):
        params = {"engine": "youtube", "search_query": q, "gl": "in", "hl": "en"}
        if not serp._cache_path(params).exists():
            continue  # only reuse searches already made: suggestions must never cost a search
        try:
            data = serp.search(params)
        except (serp.BudgetExceeded, serp.SerpApiUnavailable):
            continue
        for ch in data.get("channel_results", []) or []:
            if ch.get("title") and ch["title"] not in names:
                names.append(ch["title"])
        for v in data.get("video_results", []):
            nm = (v.get("channel") or {}).get("name")
            if nm and nm not in names:
                names.append(nm)
    return names[:n]


def search_mentions(query: str, limit: int = 10) -> list[dict]:
    """Videos from any channel mentioning a stock -- the 'who hyped this?' lookup."""
    data = serp.search({"engine": "youtube", "search_query": query, "gl": "in", "hl": "en"}, max_age_hours=24)
    return [_video(v) for v in data.get("video_results", [])[:limit] if v.get("video_id")]


def _video(v: dict) -> dict:
    approx, uncertainty = parse_relative_date(v.get("published_date"))
    ch = v.get("channel") or {}
    return {
        "video_id": v.get("video_id"),
        "title": v.get("title"),
        "url": v.get("link"),
        "channel": ch.get("name"),
        "channel_url": ch.get("link"),
        "views": v.get("views"),
        "length": v.get("length"),
        "published_text": v.get("published_date"),
        "published_date": approx.isoformat() if approx else None,
        "date_uncertainty_days": uncertainty,
        "thumbnail": (v.get("thumbnail") or {}).get("static") if isinstance(v.get("thumbnail"), dict) else v.get("thumbnail"),
    }


def ensure_exact_date(video: dict, max_uncertainty_days: int = 7) -> dict:
    """Upgrade a coarse relative date to the exact upload date if it's worth a credit."""
    if video.get("date_uncertainty_days", 9999) <= max_uncertainty_days:
        return video
    try:
        data = serp.search({"engine": "youtube_video", "v": video["video_id"], "hl": "en", "gl": "in"})
    except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
        logger.info("exact date for %s unavailable: %s", video["video_id"], exc)
        return video
    exact = _parse_exact_date(data.get("published_date"))
    if exact:
        video = {**video, "published_date": exact.isoformat(), "date_uncertainty_days": 0}
    return video


def transcript(video_id: str) -> list[dict]:
    """[{start_s, text}] in the video's own language (Hindi stays Hindi --
    the extractor reads it directly instead of a lossy translation first)."""
    data = serp.search({"engine": "youtube_video_transcript", "v": video_id})
    segs = []
    for s in data.get("transcript", []):
        text = (s.get("snippet") or "").strip()
        if text:
            segs.append({"start_s": round((s.get("start_ms") or 0) / 1000), "text": text})
    return segs
