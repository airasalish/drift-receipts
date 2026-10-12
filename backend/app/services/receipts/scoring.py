"""Scoring calls against what actually happened. Fully deterministic -- no LLM.

A call is judged against the market, not in isolation: "+6% in 30 days"
means nothing if Nifty did +9%. For a buy, the call was right if the stock
beat Nifty over the horizon; for a sell/avoid, if it lagged Nifty. Calls too
recent for a horizon are `pending`, never extrapolated.

Two tiers are kept apart on purpose, because they mean different things:
- explicit calls: the speaker told viewers to buy/sell this stock
- featured picks: presented as one of the video's picks without a direct
  instruction ("6 stocks before the bounce back")
"""

import datetime
import statistics

from app.services.receipts.prices import price_on_or_after

HORIZONS = (7, 30, 90)
HEADLINE_HORIZON = 30


def _ret(a: float, b: float) -> float:
    return round((b / a - 1) * 100, 2)


def score_call(call: dict, points: list[dict], bench_points: list[dict], call_date: datetime.date,
               today: datetime.date | None = None) -> dict:
    today = today or datetime.date.today()
    entry = price_on_or_after(points, call_date)
    bench_entry = price_on_or_after(bench_points, call_date) if bench_points else None
    out = {"entry": entry, "horizons": {}, "target_hit": None, "outcome": "no_price_data"}
    if not entry:
        return out

    sign = -1 if call["direction"] in ("sell", "avoid") else 1
    for h in HORIZONS:
        day = call_date + datetime.timedelta(days=h)
        if day > today:
            out["horizons"][str(h)] = {"status": "pending"}
            continue
        exit_ = price_on_or_after(points, day)
        bench_exit = price_on_or_after(bench_points, day) if bench_points else None
        if not exit_:
            out["horizons"][str(h)] = {"status": "no_price_data"}
            continue
        stock_ret = _ret(entry["price"], exit_["price"])
        bench_ret = _ret(bench_entry["price"], bench_exit["price"]) if bench_entry and bench_exit else None
        excess = round(sign * (stock_ret - bench_ret), 2) if bench_ret is not None else None
        out["horizons"][str(h)] = {
            "status": "done", "exit": exit_, "stock_return_pct": stock_ret,
            "nifty_return_pct": bench_ret, "excess_vs_nifty_pct": excess,
            "right": (excess > 0) if excess is not None else None,
        }

    if call.get("target_price") and call["direction"] == "buy":
        end = (call_date + datetime.timedelta(days=365)).isoformat()
        window = [p for p in points if call_date.isoformat() <= p["date"] <= end]
        if window:
            out["target_hit"] = max(p["price"] for p in window) >= call["target_price"]

    head = out["horizons"].get(str(HEADLINE_HORIZON), {})
    if head.get("status") == "pending":
        out["outcome"] = "pending"
    elif head.get("right") is True:
        out["outcome"] = "beat_market" if sign == 1 else "lagged_market_as_called"
    elif head.get("right") is False:
        out["outcome"] = "lagged_market" if sign == 1 else "beat_market_against_call"
    return out


def _tier(calls: list[dict]) -> dict:
    scored = [c for c in calls if c.get("score", {}).get("horizons", {}).get(str(HEADLINE_HORIZON), {}).get("status") == "done"]
    excess = [c["score"]["horizons"][str(HEADLINE_HORIZON)]["excess_vs_nifty_pct"] for c in scored
              if c["score"]["horizons"][str(HEADLINE_HORIZON)]["excess_vs_nifty_pct"] is not None]
    right = [c for c in scored if c["score"]["horizons"][str(HEADLINE_HORIZON)].get("right")]
    return {
        "calls": len(calls),
        "scored_30d": len(excess),
        "pending": sum(1 for c in calls if c.get("score", {}).get("outcome") == "pending"),
        "beat_nifty_30d": len(right),
        "hit_rate_30d_pct": round(100 * len(right) / len(excess), 1) if excess else None,
        "avg_excess_vs_nifty_30d_pct": round(statistics.mean(excess), 2) if excess else None,
        "median_excess_vs_nifty_30d_pct": round(statistics.median(excess), 2) if excess else None,
    }


def report_card(calls: list[dict]) -> dict:
    """Aggregate over resolved, scoreable calls. Watch-only mentions never count."""
    scoreable = [c for c in calls if c.get("ticker") and c["direction"] in ("buy", "sell", "avoid")]
    explicit = [c for c in scoreable if c.get("explicit")]
    featured = [c for c in scoreable if not c.get("explicit")]
    with_target = [c for c in scoreable if c.get("score", {}).get("target_hit") is not None]
    return {
        "explicit": _tier(explicit),
        "featured_picks": _tier(featured),
        "all_scoreable": _tier(scoreable),
        "targets_set": len(with_target),
        "targets_hit": sum(1 for c in with_target if c["score"]["target_hit"]),
        # only picks we failed to score -- a passing mention of Amazon isn't a gap in the audit
        "unresolved_companies": sorted({c["company"] for c in calls
                                        if not c.get("ticker") and c["direction"] in ("buy", "sell", "avoid")}),
        "watch_mentions": sum(1 for c in calls if c["direction"] == "watch"),
    }
