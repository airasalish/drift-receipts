"""Public regulatory context for a channel or stock, plus the built-in SEBI case study.

`mentions()` only ever *lists* sebi.gov.in pages and news articles that
mention a name, with links. It never concludes anything from them: names
collide, and an order mentioning someone is not the same as an order
against them. The reader clicks through and decides.
"""

import datetime

from app.services.receipts import serpapi_client as serp

# Facts from SEBI's final order in the matter of Sadhna Broadcast Ltd
# (May 29, 2025), section "dates on which videos promoting the scrip were
# uploaded" and the investigation-period table. Price data itself is NOT
# hardcoded -- it's fetched from Google Finance like any other stock.
SADHNA_CASE = {
    "company": "Sadhna Broadcast Ltd (now Crystal Business System Ltd)",
    "google_finance": "540821:BOM",
    "order_title": "SEBI final order in the matter of Sadhna Broadcast Limited",
    "order_date": "2025-05-29",
    "order_url": "https://www.sebi.gov.in/enforcement/orders/may-2025/final-order-in-the-matter-of-sadhna-broadcast-limited_94294.html",
    "investigation_period": ["2022-03-08", "2022-11-30"],
    "video_uploads": [
        {"date": "2022-07-15", "channel": "Moneywise"},
        {"date": "2022-07-17", "channel": "The Advisor"},
        {"date": "2022-07-28", "channel": "The Advisor"},
        {"date": "2022-07-28", "channel": "The Advisor"},
        {"date": "2022-07-28", "channel": "Moneywise"},
        {"date": "2022-09-02", "channel": "Moneywise"},
    ],
    "order_findings": [
        "Videos 'falsely projected the Company as a turnaround story and gave unrealistic target prices'",
        "Videos were pushed with paid Google Ads campaigns (Rs 3.39 crore from one noticee's account alone)",
        "Promoter-connected entities sold shares at the inflated prices",
    ],
}


def mentions(name: str) -> dict:
    """sebi.gov.in pages + recent news mentioning `name` (2 credits, cached a week)."""
    out = {"name": name, "sebi_pages": [], "news": [], "checked": True}
    try:
        web = serp.search({"engine": "google", "q": f'site:sebi.gov.in "{name}"', "gl": "in", "hl": "en", "num": 10},
                          max_age_hours=24 * 7)
        out["sebi_pages"] = [{"title": r.get("title"), "url": r.get("link"), "snippet": r.get("snippet")}
                             for r in web.get("organic_results", [])[:6]]
        news = serp.search({"engine": "google_news", "q": f'"{name}" SEBI', "gl": "in", "hl": "en"},
                           max_age_hours=24 * 7)
        out["news"] = [{"title": n.get("title"), "url": n.get("link"), "source": (n.get("source") or {}).get("name"),
                        "date": n.get("date")} for n in news.get("news_results", [])[:6]]
    except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
        out["checked"] = False
        out["reason"] = str(exc)
    return out


def news(query: str, limit: int = 8) -> dict:
    """Recent Google News headlines for a stock or creator (1 credit, cached a
    week; offline mode serves the saved copy). Headlines only, with links --
    nothing is concluded from them."""
    try:
        res = serp.search({"engine": "google_news", "q": query, "gl": "in", "hl": "en"}, max_age_hours=24 * 7)
    except (serp.BudgetExceeded, serp.SerpApiUnavailable) as exc:
        return {"query": query, "items": [], "checked": False, "reason": str(exc)}
    items = []
    for n in res.get("news_results", []):
        # Google News groups stories; take the lead story of a cluster
        lead = n if n.get("title") else (n.get("stories") or [{}])[0]
        if not lead.get("title") or not lead.get("link"):
            continue
        src = lead.get("source") or {}
        items.append({"title": lead["title"], "url": lead["link"], "source": src.get("name"),
                      "icon": src.get("icon"), "date": lead.get("iso_date") or lead.get("date"),
                      "thumbnail": lead.get("thumbnail_small") or lead.get("thumbnail")})
    items.sort(key=lambda x: x["date"] or "", reverse=True)
    return {"query": query, "items": items[:limit], "checked": True, "stale": bool(res.get("_cache_stale"))}


def case_dates() -> list[datetime.date]:
    return sorted({datetime.date.fromisoformat(v["date"]) for v in SADHNA_CASE["video_uploads"]})
