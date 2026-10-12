"""Pump-and-dump *pattern* check around a promotion date. Deterministic rules,
same philosophy as change_detection.py: every flag shows the exact numbers.

The shape comes from SEBI's own findings in YouTube-promoted pump-and-dump
cases (e.g. the 2023 Sadhna Broadcast / Sharpline orders): an illiquid,
low-priced stock; heavy promotion; a volume explosion and price run-up after
the promotion; then a collapse once the promoters sell.

This flags a *price/volume pattern*. It is not a finding that anyone did
anything wrong -- the UI words it exactly that way. Thresholds are
deliberately high so ordinary momentum stocks don't trip all four rules.
"""

import datetime
import statistics

BASELINE_DAYS = 90       # "before" window, ending the day before the promotion
RUNUP_DAYS = 120         # how long after the promotion to look for the peak
COLLAPSE_DAYS = 365      # how long after the peak to look for the collapse
RULES = {
    "illiquid": "Thinly traded before the promotion",
    "volume_spike": "Volume exploded after the promotion",
    "price_runup": "Price ran up sharply after the promotion",
    "collapse": "Price later collapsed from its peak",
}
VOLUME_SPIKE_X = 10.0
RUNUP_X = 2.0
COLLAPSE_PCT = 50.0
ILLIQUID_DAILY_TURNOVER_INR = 50_00_000  # Rs 50 lakh/day


def _spacing_days(points: list[dict]) -> float:
    if len(points) < 2:
        return 1.0
    ds = [datetime.date.fromisoformat(p["date"]) for p in points]
    gaps = [(b - a).days for a, b in zip(ds, ds[1:]) if (b - a).days > 0]
    return statistics.median(gaps) if gaps else 1.0


def analyse(points: list[dict], promoted_on: datetime.date) -> dict:
    iso = promoted_on.isoformat()
    start = (promoted_on - datetime.timedelta(days=BASELINE_DAYS)).isoformat()
    end = (promoted_on + datetime.timedelta(days=RUNUP_DAYS)).isoformat()
    before = [p for p in points if start <= p["date"] < iso]
    after = [p for p in points if iso <= p["date"] <= end]
    if len(before) < 2 or not after:
        return {"status": "insufficient_data", "fired": [], "metrics": {}}

    step = _spacing_days(points)  # 1 for daily data, ~7 for Google Finance's 5Y weekly series
    vols_before = [p["volume"] for p in before if p.get("volume")]
    base_vol = statistics.mean(vols_before) if vols_before else None
    base_price = statistics.mean(p["price"] for p in before)
    entry = after[0]["price"]
    peak = max(after, key=lambda p: p["price"])
    peak_vol = max((p["volume"] for p in after if p.get("volume")), default=None)
    # collapse is judged within a year of the peak -- any stock falls far
    # enough eventually, so an open-ended window would flag everything
    collapse_end = (datetime.date.fromisoformat(peak["date"]) + datetime.timedelta(days=COLLAPSE_DAYS)).isoformat()
    later = [p for p in points if peak["date"] < p["date"] <= collapse_end]
    trough = min(later, key=lambda p: p["price"]) if later else None

    daily_turnover = (base_price * base_vol / step) if base_vol else None
    m = {
        "baseline_avg_price": round(base_price, 2),
        "baseline_daily_turnover_inr": round(daily_turnover) if daily_turnover is not None else None,
        "price_at_promotion": entry,
        "peak_price": peak["price"], "peak_date": peak["date"],
        "runup_x": round(peak["price"] / entry, 2) if entry else None,
        "volume_spike_x": round(peak_vol / base_vol, 1) if peak_vol and base_vol else None,
        "trough_after_peak": trough["price"] if trough else None,
        "trough_date": trough["date"] if trough else None,
        "drawdown_from_peak_pct": round((1 - trough["price"] / peak["price"]) * 100, 1) if trough else None,
        "data_spacing_days": step,
    }

    fired = []
    if daily_turnover is not None and daily_turnover < ILLIQUID_DAILY_TURNOVER_INR:
        fired.append({"rule": "illiquid", "label": RULES["illiquid"],
                      "detail": f"~Rs {daily_turnover:,.0f}/day traded in the {BASELINE_DAYS} days before"})
    if m["volume_spike_x"] and m["volume_spike_x"] >= VOLUME_SPIKE_X:
        fired.append({"rule": "volume_spike", "label": RULES["volume_spike"],
                      "detail": f"peak volume {m['volume_spike_x']:,.0f}x the pre-promotion average"})
    if m["runup_x"] and m["runup_x"] >= RUNUP_X:
        fired.append({"rule": "price_runup", "label": RULES["price_runup"],
                      "detail": f"Rs {entry:g} -> Rs {peak['price']:g} ({m['runup_x']}x) by {peak['date']}"})
    if m["drawdown_from_peak_pct"] is not None and m["drawdown_from_peak_pct"] >= COLLAPSE_PCT:
        fired.append({"rule": "collapse", "label": RULES["collapse"],
                      "detail": f"-{m['drawdown_from_peak_pct']}% from peak, to Rs {trough['price']:g} by {trough['date']}"})

    keys = {f["rule"] for f in fired}
    if {"volume_spike", "price_runup", "collapse"} <= keys:
        level = "full_pattern"
    elif {"volume_spike", "price_runup"} <= keys:
        level = "pump_in_progress"
    elif keys & {"volume_spike", "price_runup"}:
        level = "partial"
    else:
        level = "none"
    return {"status": "ok", "level": level, "fired": fired, "metrics": m}
