"""Orchestration: the three things Receipts can do, each a pure function
returning a JSON-ready dict.

- audit_channel: every recent stock call from one YouTube channel, scored
- hype_check: who promoted a stock on YouTube, and does its price/volume
  since then match the pump-and-dump pattern
- sebi_case_study: the validation case -- run on the stock and dates from a
  real SEBI order, using live Google Finance data

Finished reports are saved to data/receipts_reports/ and reused for a day,
so reopening a report never spends credits again.
"""

import datetime
import json
import logging
import pathlib
import re

from app.services.receipts import extraction, prices, pump, scoring, sebi, tickers, youtube
from app.services.receipts import serpapi_client as serp

logger = logging.getLogger(__name__)

REPORTS_DIR = serp.DATA_DIR / "receipts_reports"
TMP_REPORTS_DIR = serp.TMP_CACHE_DIR.parent / "receipts_reports"


def _loose(name: str) -> str:
    """'Lalitha Dwellers' and 'Lalita Dwellers Limited' -> same key (caption spelling differences)."""
    name = re.sub(r"\b(limited|ltd|pvt|private|company|co|inc)\b\.?", "", name.lower())
    return re.sub(r"h|[^a-z]", "", name)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "x"


def _load(kind: str, key: str, max_age_hours: float = 24) -> dict | None:
    path = REPORTS_DIR / f"{kind}_{_slug(key)}.json"
    if not path.exists():
        path = TMP_REPORTS_DIR / path.name  # a live check saved on a read-only host
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    made = datetime.datetime.fromisoformat(data["generated_at"])
    if serp._offline() or datetime.datetime.utcnow() - made <= datetime.timedelta(hours=max_age_hours):
        return data
    return None


def _save(kind: str, key: str, data: dict) -> dict:
    data["generated_at"] = datetime.datetime.utcnow().isoformat(timespec="seconds")
    body = json.dumps(data, indent=1, ensure_ascii=False)
    for folder in (REPORTS_DIR, TMP_REPORTS_DIR):
        try:
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{kind}_{_slug(key)}.json").write_text(body, encoding="utf-8")
            break
        except OSError:  # read-only filesystem (Vercel): try the temp folder, else just return it
            continue
    else:
        logger.warning("could not save %s report for %s", kind, key)
    return data


def audit_channel(channel: str, max_videos: int = 4, refresh: bool = False, live: bool = False) -> dict:
    if not refresh and (cached := _load("channel", channel)):
        # aggregation is cheap and deterministic -- recompute so a saved
        # report always reflects the current scoring rules
        cached["report_card"] = scoring.report_card(cached.get("calls", []))
        return cached
    credits_before = serp.usage()["used"]
    notes: list[str] = []

    found = youtube.channel_videos(channel, limit=20, picks_first=live)
    # a live check tries likely stock-pick videos first and keeps going until
    # it has read `max_videos` transcripts (its search cap still applies)
    videos = youtube.rank_for_tips(found)[: max_videos + 2] if live else youtube.pick_scoreable(found, max_videos)
    if not videos:
        return {"channel": channel, "status": "no_videos_found", "videos": [], "calls": [],
                "notes": [f"No recent stock videos from a channel matching '{channel}'."],
                "suggestions": youtube.channel_suggestions(channel) if live else []}

    calls: list[dict] = []
    read = 0
    for v in videos:
        if live and read >= max_videos:
            v["transcript_status"] = "not needed"
            continue
        v.update(youtube.ensure_exact_date(v))
        try:
            segs = youtube.transcript(v["video_id"])
        except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
            v["transcript_status"] = f"unavailable: {exc}"
            continue
        if not segs:
            v["transcript_status"] = "none"
            continue
        ex = extraction.extract_calls_cached(v["video_id"], segs, title=v.get("title"))
        v["transcript_status"] = "ok"
        read += 1
        v["extraction"] = {k: ex[k] for k in ("rejected_unverified", "chunks", "llm_failed_chunks")}
        by_loose_name: dict[str, dict] = {}  # spelling variants in one video share a resolution
        for c in ex["calls"]:
            res = by_loose_name.get(_loose(c["company"])) or tickers.resolve(c["company"], c.get("symbol_guess"))
            if res is None and c["direction"] in ("buy", "sell", "avoid"):
                res = tickers.resolve_via_search(c["company"])  # only picks are worth a credit, not passing mentions
            c["ticker"] = res
            if res:
                by_loose_name[_loose(c["company"])] = res
        seen_tickers = set()
        for c in ex["calls"]:
            res = c["ticker"] = c["ticker"] or by_loose_name.get(_loose(c["company"]))
            # two spellings of one company in the same video are one call
            k = (res["yahoo_symbol"], c["direction"]) if res else (_loose(c["company"]), c["direction"])
            if k in seen_tickers:
                continue
            seen_tickers.add(k)
            # a few transcript lines around the call, for the evidence map
            i = next((j for j, s in enumerate(segs) if s["start_s"] == c["start_s"]), None)
            c["context"] = ([{"start_s": s["start_s"], "text": s["text"]} for s in segs[max(0, i - 2): i + 3]]
                            if i is not None else [])
            c.update({
                "video_id": v["video_id"], "video_title": v["title"], "video_url": v["url"],
                "timestamp_url": f"https://www.youtube.com/watch?v={v['video_id']}&t={c['start_s']}s",
                "call_date": v["published_date"], "date_uncertainty_days": v["date_uncertainty_days"],
            })
            calls.append(c)

    _score_calls(calls, notes)
    report = {
        "channel": channel,
        "channel_url": next((v["channel_url"] for v in videos if v.get("channel_url")), None),
        "status": "ok",
        "videos": videos,
        "calls": sorted(calls, key=lambda c: (c["call_date"] or "", c["start_s"]), reverse=True),
        "report_card": scoring.report_card(calls),
        # a live check spends its few searches on videos, not on news
        "regulatory": {"checked": False, "sebi_pages": [], "news": [], "reason": "skipped in a live check"} if live else sebi.mentions(channel),
        "notes": notes,
        "credits_used": (serp.live_state() or {}).get("used") if live else serp.usage()["used"] - credits_before,
        "live": live,
    }
    return _save("channel", channel, report)


def _score_calls(calls: list[dict], notes: list[str]) -> None:
    """One price lookup per ticker (covering its oldest call) + one Nifty lookup, then score."""
    dated = [c for c in calls if c.get("ticker") and c.get("call_date") and c["direction"] in ("buy", "sell", "avoid")]
    if not dated:
        return
    oldest = min(datetime.date.fromisoformat(c["call_date"]) for c in dated)
    bench = prices.benchmark(oldest)
    if not bench:
        notes.append("Nifty 50 history unavailable -- returns are shown without the market comparison.")
    by_ticker: dict[str, list[dict]] = {}
    for c in dated:
        by_ticker.setdefault(c["ticker"]["yahoo_symbol"], []).append(c)
    for sym, group in by_ticker.items():
        since = min(datetime.date.fromisoformat(c["call_date"]) for c in group)
        s = prices.series(group[0]["ticker"]["google_finance"], sym, since)
        for c in group:
            if not s:
                c["score"] = {"outcome": "no_price_data", "horizons": {}}
                continue
            d = datetime.date.fromisoformat(c["call_date"])
            c["score"] = scoring.score_call(c, s["points"], bench["points"] if bench else [], d)
            c["price_source"] = s["source"]
            c["pump_check"] = pump.analyse(s["points"], d)


MAP_VIDEOS = 3


def _mentions_in_video(v: dict, res: dict | None, name: str) -> list[dict] | None:
    """Every moment in one video where this stock comes up, with the AI's
    verified evidence. None means the transcript couldn't be read."""
    try:
        segs = youtube.transcript(v["video_id"])
    except (serp.BudgetExceeded, serp.SerpApiUnavailable):
        return None
    if not segs:
        return None
    ex = extraction.extract_calls_cached(v["video_id"], segs, title=v.get("title"))
    want = _loose(name)
    out = []
    for c in ex["calls"]:
        hit = tickers.resolve(c["company"], c.get("symbol_guess"))
        same = (res and hit and hit["yahoo_symbol"] == res["yahoo_symbol"]) or _loose(c["company"])[:8] in want
        if not same:
            continue
        i = next((j for j, s in enumerate(segs) if s["start_s"] == c["start_s"]), None)
        out.append({
            **{k: c.get(k) for k in ("direction", "explicit", "target_price", "quote", "start_s", "line", "evidence", "reason")},
            "timestamp_url": f"https://www.youtube.com/watch?v={v['video_id']}&t={c['start_s']}s",
            "context": [{"start_s": s["start_s"], "text": s["text"]} for s in segs[max(0, i - 2): i + 3]] if i is not None else [],
        })
    return out


def hype_check(company: str, refresh: bool = False) -> dict:
    """Who promoted this stock on YouTube recently, and what did it do after?"""
    if not refresh and (cached := _load("hype", company, max_age_hours=12)):
        return cached
    res = tickers.resolve(company)
    name = res["name"] if res else company
    videos = youtube.search_mentions(f"{name} share target", limit=10)
    dated = sorted((v for v in videos if v.get("published_date")), key=lambda v: v["published_date"])
    out = {"company": name, "ticker": res, "videos": dated, "pump_check": None, "series": None}
    # read the top few videos and pin down where this stock is mentioned
    # (1 transcript credit each; the AI read is cached per video)
    for v in sorted(videos, key=lambda v: v.get("views") or 0, reverse=True)[:MAP_VIDEOS]:
        v["mentions"] = _mentions_in_video(v, res, name)
    if res and dated:
        first = datetime.date.fromisoformat(dated[0]["published_date"])
        s = prices.series(res["google_finance"], res["yahoo_symbol"], first - datetime.timedelta(days=100))
        if s:
            out["pump_check"] = pump.analyse(s["points"], first)
            out["pump_check"]["promotion_date_used"] = first.isoformat()
            out["series"] = {k: s[k] for k in ("source", "symbol", "window")} | {"points": s["points"]}
    return _save("hype", company, out)


def sebi_case_study() -> dict:
    case = sebi.SADHNA_CASE
    s = prices.google_finance_series(case["google_finance"], "5Y")
    first = sebi.case_dates()[0]
    return {
        "case": case,
        "series": {"source": s["source"], "symbol": s["symbol"], "window": s["window"], "name": s["name"],
                   "points": s["points"], "stale": s["stale"]},
        "pump_check": pump.analyse(s["points"], first) | {"promotion_date_used": first.isoformat()},
        "yahoo_has_data": False,  # verified during development: Yahoo returns nothing for 540821.BO
    }
