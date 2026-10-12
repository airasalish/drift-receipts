"""Receipts tests. All offline: no SerpApi credits, no LLM calls.

The pump-and-dump tests run on the real Google Finance response for the
SEBI Sadhna Broadcast case, committed under data/serpapi_cache/.
"""

import datetime

import pytest

from app.services.receipts import extraction, prices, pump, scoring, sebi, tickers, youtube
from app.services.receipts import serpapi_client as serp


@pytest.fixture
def offline(monkeypatch):
    monkeypatch.setenv("SERPAPI_OFFLINE", "1")


@pytest.fixture
def sadhna_points(offline):
    s = prices.google_finance_series("540821:BOM", "5Y")
    assert s["points"], "cached Google Finance response for the SEBI case is missing"
    return s["points"]


# --- pump-and-dump pattern ---------------------------------------------------

def test_sebi_case_first_video_date_fires_full_pattern(sadhna_points):
    r = pump.analyse(sadhna_points, datetime.date(2022, 7, 15))  # first upload per SEBI's order
    assert r["level"] == "full_pattern"
    assert {f["rule"] for f in r["fired"]} == {"illiquid", "volume_spike", "price_runup", "collapse"}
    assert r["metrics"]["peak_date"] == "2022-08-12"
    assert r["metrics"]["volume_spike_x"] >= 10


def test_quiet_period_on_same_stock_does_not_fire(sadhna_points):
    r = pump.analyse(sadhna_points, datetime.date(2024, 3, 1))
    assert r["level"] == "none"


def test_insufficient_history_is_reported_not_guessed(sadhna_points):
    r = pump.analyse(sadhna_points, datetime.date(2021, 10, 8))  # series starts Oct 2021
    assert r["status"] == "insufficient_data"


def test_case_study_dates_come_from_the_order():
    assert sebi.case_dates()[0] == datetime.date(2022, 7, 15)
    assert sebi.SADHNA_CASE["order_url"].startswith("https://www.sebi.gov.in/")


# --- scoring against Nifty ---------------------------------------------------

def _series(start: datetime.date, prices_: list[float], step: int = 1):
    return [{"date": (start + datetime.timedelta(days=i * step)).isoformat(), "price": p, "volume": 1000}
            for i, p in enumerate(prices_)]


def test_buy_that_beats_nifty_is_right():
    d0 = datetime.date(2026, 1, 1)
    stock = _series(d0, [100] * 30 + [120] * 70)   # +20% by day 30
    nifty = _series(d0, [100] * 30 + [105] * 70)   # +5%
    s = scoring.score_call({"direction": "buy"}, stock, nifty, d0, today=datetime.date(2026, 6, 1))
    h = s["horizons"]["30"]
    assert h["stock_return_pct"] == 20.0 and h["nifty_return_pct"] == 5.0
    assert h["excess_vs_nifty_pct"] == 15.0 and h["right"] is True
    assert s["outcome"] == "beat_market"


def test_sell_call_is_right_when_stock_lags():
    d0 = datetime.date(2026, 1, 1)
    stock = _series(d0, [100] * 30 + [90] * 70)
    nifty = _series(d0, [100] * 100)
    s = scoring.score_call({"direction": "sell"}, stock, nifty, d0, today=datetime.date(2026, 6, 1))
    assert s["horizons"]["30"]["right"] is True


def test_recent_call_is_pending_not_extrapolated():
    d0 = datetime.date(2026, 10, 1)
    stock = _series(d0, [100, 101, 102])
    s = scoring.score_call({"direction": "buy"}, stock, stock, d0, today=datetime.date(2026, 10, 7))
    assert s["outcome"] == "pending"
    assert s["horizons"]["30"] == {"status": "pending"}


def test_weekend_call_enters_at_next_trading_price_never_before():
    pts = [{"date": "2026-01-02", "price": 100}, {"date": "2026-01-05", "price": 110}]
    assert prices.price_on_or_after(pts, datetime.date(2026, 1, 3))["price"] == 110


def test_report_card_ignores_watch_and_unresolved():
    calls = [
        {"company": "A", "direction": "watch", "ticker": {"yahoo_symbol": "A.NS"}},
        {"company": "B", "direction": "buy", "ticker": None},
        {"company": "Amazon", "direction": "watch", "ticker": None},
    ]
    rc = scoring.report_card(calls)
    assert rc["all_scoreable"]["calls"] == 0
    assert rc["unresolved_companies"] == ["B"] and rc["watch_mentions"] == 2


# --- quote verification (the anti-hallucination gate) -------------------------

SEGS = [
    {"start_s": 320, "text": "सबसे पहली कंपनी है एरोफ्लेक्स इंडस्ट्री। यह जो कंपनी है, यह"},
    {"start_s": 442, "text": "दूसरी कंपनी है dictin टेक्नोलॉजी।"},
]


def test_exact_hindi_quote_is_verified_and_real_timestamp_wins():
    seg = extraction.verify_quote("दूसरी कंपनी है dictin टेक्नोलॉजी", 440, SEGS)
    assert seg is not None and seg["start_s"] == 442


def test_invented_quote_is_rejected():
    assert extraction.verify_quote("इसे अभी खरीद लो टारगेट 500", 442, SEGS) is None


def test_quote_far_from_claimed_timestamp_is_rejected():
    assert extraction.verify_quote("दूसरी कंपनी है dictin टेक्नोलॉजी", 30, SEGS[:1] + [{"start_s": 900, "text": "x"}]) is None


# --- small parsers -------------------------------------------------------------

def test_relative_dates_carry_honest_uncertainty():
    today = datetime.date(2026, 10, 7)
    assert youtube.parse_relative_date("1d ago", today) == (datetime.date(2026, 10, 6), 0)
    assert youtube.parse_relative_date("2w ago", today) == (datetime.date(2026, 9, 23), 3)
    d, unc = youtube.parse_relative_date("3 months ago", today)
    assert unc == 15
    assert youtube.parse_relative_date("garbage", today) == (None, 9999)


def test_yahoo_to_google_finance_symbols():
    assert tickers.to_google_finance("TATAMOTORS.NS") == "TATAMOTORS:NSE"
    assert tickers.to_google_finance("540821.BO") == "540821:BOM"
    assert tickers.to_google_finance("AAPL") is None


def test_google_finance_window_covers_the_horizon():
    today = datetime.date(2026, 10, 7)
    assert prices.window_for(datetime.date(2026, 10, 1), today) == "1M"
    assert prices.window_for(datetime.date(2022, 7, 15), today) == "5Y"


# --- credit guard ----------------------------------------------------------------

def test_offline_cache_miss_raises_instead_of_calling(offline, tmp_path, monkeypatch):
    monkeypatch.setattr(serp, "CACHE_DIR", tmp_path)
    with pytest.raises(serp.SerpApiUnavailable):
        serp.search({"engine": "google", "q": "never cached"})


def test_budget_guard_blocks_real_calls(tmp_path, monkeypatch):
    monkeypatch.setattr(serp, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(serp, "USAGE_FILE", tmp_path / "usage.json")
    monkeypatch.setenv("SERPAPI_API_KEY", "test-key")
    monkeypatch.setenv("SERPAPI_MONTHLY_BUDGET", "0")
    monkeypatch.delenv("SERPAPI_OFFLINE", raising=False)

    def boom(*a, **k):
        raise AssertionError("network must not be touched when over budget")

    monkeypatch.setattr(serp.requests, "get", boom)
    with pytest.raises(serp.BudgetExceeded):
        serp.search({"engine": "google", "q": "x"})


def test_live_mode_caps_searches_per_request(monkeypatch, tmp_path):
    """A live check may spend only its own small allowance, then gets BudgetExceeded."""
    from app.services.receipts import serpapi_client as serp

    monkeypatch.setenv("SERPAPI_OFFLINE", "1")
    monkeypatch.setenv("SERPAPI_API_KEY", "test-key")
    monkeypatch.setattr(serp, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(serp, "TMP_CACHE_DIR", tmp_path / "tmpcache")
    monkeypatch.setattr(serp, "USAGE_FILE", tmp_path / "usage.json")

    calls = []

    class Resp:
        def json(self):
            return {"ok": True}

    monkeypatch.setattr(serp.requests, "get", lambda *a, **k: calls.append(1) or Resp())

    # outside a live check, offline mode never touches the network
    try:
        serp.search({"engine": "youtube", "search_query": "x"})
        raise AssertionError("offline search should not succeed without a cache")
    except serp.SerpApiUnavailable:
        pass
    assert calls == []

    with serp.live_mode(max_calls=2):
        serp.search({"engine": "youtube", "search_query": "a"})
        serp.search({"engine": "youtube", "search_query": "b"})
        try:
            serp.search({"engine": "youtube", "search_query": "c"})
            raise AssertionError("third search should exceed the live cap")
        except serp.BudgetExceeded:
            pass
    assert len(calls) == 2
    # and once the check ends, the site is offline again
    assert serp._offline() is True


def test_ticker_match_must_resemble_what_was_heard():
    from app.services.receipts.tickers import plausible

    assert not plausible("India Dynamics Ltd", "State Bank of India", "SBIN.NS")  # shares only "India"
    assert plausible("Bharat Dynamics", "Bharat Dynamics Limited", "BDL.NS")
    assert plausible("BHEL Ltd", "Bharat Heavy Electricals Limited", "BHEL.NS")  # ticker
    assert plausible("Rural Electrification Corporation Ltd", "REC Limited", "RECLTD.NS")  # acronym
    assert plausible("Lalita Dwellers Ltd", "Lalithaa Jewellery Mart Limited", "LALITHAA.NS")  # misheard spelling


def test_yahoo_history_parses_bars_in_exchange_time(monkeypatch):
    from app.services.receipts import yahoo

    payload = {"chart": {"result": [{
        "meta": {"gmtoffset": 19800},  # IST
        "timestamp": [1759981500, 1760067900, 1760154300],
        "indicators": {"quote": [{"open": [10, 11, None], "high": [12, 13, None], "low": [9, 10, None],
                                  "close": [11.5, 12.5, None], "volume": [100, 200, None]}]},
    }]}}

    class Resp:
        def json(self):
            return payload

    monkeypatch.setattr(yahoo.requests, "get", lambda *a, **k: Resp())
    bars = yahoo.history("X.NS", range_="5d")
    assert [b["close"] for b in bars] == [11.5, 12.5]  # the day with no close is dropped
    assert bars[0]["date"] == "2025-10-09" and bars[0]["ts"].hour == 9  # 03:45 UTC -> 09:15 IST


def test_resolver_prefers_the_closest_name(monkeypatch):
    from app.services.receipts import tickers

    quotes = (
        {"symbol": "HCL-INSYS.NS", "quoteType": "EQUITY", "longname": "HCL Infosystems Limited"},
        {"symbol": "INFY.NS", "quoteType": "EQUITY", "longname": "Infosys Limited"},
    )
    monkeypatch.setattr(tickers, "_search", lambda q: quotes)
    assert tickers.resolve("Infosys Ltd.")["yahoo_symbol"] == "INFY.NS"


def test_raw_serves_only_saved_serpapi_responses():
    from app.services.receipts import dashboard

    for bad in ["../.env", "..%2F.env", "serpapi_usage.json", "youtube_123.json", "secrets_aaaaaaaaaaaa.json", "google_finance_ZZZZZZZZZZZZ.json"]:
        assert dashboard.raw(bad) is None


def test_live_check_prefers_stock_pick_videos():
    from app.services.receipts import youtube

    vids = [
        {"title": "What is GIFT NIFTY? | Benefits", "published_date": "2025-11-14", "date_uncertainty_days": 0},
        {"title": "2 Stocks from Defence Space", "published_date": "2026-03-14", "date_uncertainty_days": 0},
    ]
    assert youtube.rank_for_tips(vids)[0]["title"].startswith("2 Stocks")


def test_channel_match_ignores_spacing_and_retries_on_the_name(monkeypatch):
    from app.services.receipts import youtube

    asked = []

    def fake_search(params, max_age_hours=None):
        asked.append(params["search_query"])
        if params["search_query"].endswith(" stocks"):
            return {"video_results": [{"title": "x", "link": "l", "channel": {"name": "Someone Else"}}]}
        return {"video_results": [{"title": "Top 5 stocks", "link": "https://youtube.com/watch?v=abc", "published_date": "2 months ago",
                                   "channel": {"name": "InvestAajForKal", "link": "https://www.youtube.com/@InvestAajForKal"}}]}

    monkeypatch.setattr(youtube.serp, "search", fake_search)
    vids = youtube.channel_videos("Invest Aaj For Kal")
    assert asked == ["Invest Aaj For Kal stocks", "Invest Aaj For Kal"]
    assert len(vids) == 1


def test_first_look_only_skips_confident_non_finance():
    from app.services.receipts.profile_ai import skip_search

    base = {"known": True, "category": "entertainment", "gives_stock_tips": "never", "confidence": 0.95}
    assert skip_search(base)
    assert not skip_search({**base, "confidence": 0.6})  # unsure -> run the real check
    assert not skip_search({**base, "known": False})
    assert not skip_search({**base, "category": "finance"})
    assert not skip_search({**base, "gives_stock_tips": "sometimes"})
    assert not skip_search({"known": True, "category": "unknown", "gives_stock_tips": "unknown", "confidence": None})


def test_rejected_ai_key_is_an_error_not_zero_tips(monkeypatch):
    import pytest

    from app.services.receipts import extraction

    class AuthenticationError(Exception):
        pass

    class FakeGroq:
        def __init__(self, api_key):
            self.chat = self
            self.completions = self

        def create(self, **kw):
            raise AuthenticationError("invalid api key")

    monkeypatch.setenv("GROQ_API_KEYS", "bad1,bad2")
    monkeypatch.setattr(extraction, "Groq", FakeGroq)
    with pytest.raises(extraction.AIUnavailable):
        extraction._llm_json("[0:01] buy Infosys")
