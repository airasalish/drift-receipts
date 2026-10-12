# Receipts

[![CI](https://github.com/airasalish/receipts/actions/workflows/ci.yml/badge.svg)](https://github.com/airasalish/receipts/actions/workflows/ci.yml)

**A track record for every stock tip on YouTube.**

Every day, Indian finance YouTubers tell millions of viewers which shares to buy. Nobody keeps score. Receipts goes back to the videos, finds each recommendation in the speaker's own words (Hindi, Hinglish or English), pins it to the exact second it was said, and measures what the stock actually did in the **30 days after the video, against the Nifty 50**.

**Live demo:** https://receipts-india.vercel.app/receipts

> Receipts does not give investment advice and does not accuse anyone of anything. It records what was said, when, and what the market did next. Every claim links to the moment in the video so you can check it yourself.

---

## Why this matters

- SEBI has spent the last few years acting against finfluencers: ₹546 crore impounded from Avadhut Sathe's academy (interim order, Dec 2025), a final order in the Sadhna Broadcast YouTube pump-and-dump that named actor Arshad Warsi, the "Baap of Chart" recovery, and more. The site's **Scam watch** strip links to each report.
- A viewer has no easy way to ask "this channel told me to buy, so how did its last ten picks do?" The information exists, but it is buried in hours of video and years of price data.

Receipts does the digging and shows the receipt.

## What you can do

| Page | What it shows |
|---|---|
| **Home** | Live enforcement headlines (Google News), one search, every audited creator with their score ("7/9 tips beat the market"), a feed of the latest tips, a 10-second "Guess the tip" game, and Scam watch (real SEBI cases with sources) |
| **Check any YouTuber** | Type any name. A free AI first look says at once if the channel doesn't give stock tips (MrBeast, say), so no searches are wasted. Otherwise a live check finds their stock videos through SerpApi, reads the transcripts and scores every tip in about a minute, using at most 6 searches |
| **Creator** | Every stock tip they gave, printed as a receipt and grouped by video: the quote, price on the video day, price a month later, stock vs market, what ₹10,000 became, and a ✓ / ✗ stamp. Tap a receipt to watch the exact second it was said |
| **Stock** | Receipts from every audited creator who named it, other YouTube videos that talked about it, and the latest Google News headlines |
| **The SEBI case** | Validation: the pump-and-dump detector run on Sadhna Broadcast, the stock from a real SEBI order, using live Google Finance data. It flags the full pattern |
| **Watchlists** | Pre-made lists, candlestick charts, "what's unusual today" signals, notes, and which audited creators mentioned each stock |
| **About** | Who it's for, what "better than the market" means, where the data comes from, and what Receipts is not |

## How SerpApi powers it

> **See it for yourself on the live site:** open any creator → **Table** → **Details** on a tip. Step 5 lists the exact SerpApi searches that tip was built from (engine, query, SerpApi search ID, time fetched), each with a **Raw JSON** link to the response as SerpApi returned it.

Six SerpApi engines, each picked for a specific job:

| Engine | Used for | Where |
|---|---|---|
| `youtube` | Find a channel's recent videos, and find videos that promote a given stock | `services/receipts/youtube.py`, `dashboard.py` |
| `youtube_video` | Exact upload date for older videos (YouTube search only says "1 year ago", and scoring needs the real day) | `youtube.py` |
| `youtube_video_transcript` | The timestamped transcript, in the language it was spoken | `youtube.py`, `dashboard.py` |
| `google_finance` | Price and volume history to score each claim. Chosen over free sources because it covers small **BSE-only** stocks (the kind used in pump-and-dumps) that Yahoo has no data for at all | `prices.py` |
| `google` | Resolve a spoken company name to a real listing when the listing search is unsure; find sebi.gov.in pages mentioning a name | `tickers.py`, `sebi.py` |
| `google_news` | News coverage of regulatory action around a creator or stock | `sebi.py` |

**Built for the free plan (250 searches a month).** All SerpApi calls go through one client (`backend/app/services/receipts/serpapi_client.py`) that:

- **caches every response** to `backend/data/serpapi_cache/`, keyed by its parameters. Transcripts and old prices never change, so each is paid for once;
- enforces a **hard monthly budget** (`SERPAPI_MONTHLY_BUDGET`). When it runs out, features show "not checked" instead of making things up;
- has an **offline mode** (`SERPAPI_OFFLINE=1`) that serves only saved results, so browsing the public site never spends a search;
- supports **live checks**: on any creator Receipts hasn't checked yet, press **Run live check** to watch a real audit happen (YouTube search, transcripts, AI reading, scoring). Each check is capped at a few searches (`LIVE_MAX_CALLS`, default 6), uses free Yahoo prices instead of Google Finance, is limited to one per visitor every few minutes, and is refused once SerpApi's own remaining balance drops below a reserve (`LIVE_RESERVE`, default 15). **The public demo has no API keys deployed, so live checks are off there; they work as soon as you run it locally with your own key.**

## How a claim is made and scored

```
YouTube search ──► transcript ──► LLM reads it ──► quote verified ──► ticker resolved ──► Google Finance prices ──► scored vs Nifty
  (SerpApi)         (SerpApi)     (Groq)            against transcript   (listing index)       (SerpApi)              (deterministic)
```

1. **Extraction (the only step that uses an LLM).** `openai/gpt-oss-120b` on Groq reads the transcript in its original language and lists recommendations: company, buy / sell / hold / avoid / watch, target, stop-loss, and a **verbatim quote with its timestamp**.
2. **Verification.** Each quote is searched for in the transcript lines around the claimed timestamp. If it isn't found, the claim is dropped. A made-up "he said BUY" is the worst error this product could show, so it is filtered out by code, not by prompting.
3. **Ticker resolution.** The model only proposes a company name. Turning it into a ticker is done against a real listing index; a name that doesn't resolve stays unscored.
4. **Scoring, with no LLM.** For a buy, the call was right if the stock **beat the Nifty 50** over the 30 days after the video; for a sell or avoid, if it lagged. Calls less than 30 days old are "pending", never extrapolated. Passing mentions ("keep an eye on banks") are shown but never scored.
5. **Pump-and-dump pattern check.** Four deterministic rules taken from SEBI's own findings: an illiquid low-priced stock, a volume explosion after promotion, a price run-up, then a collapse. It flags a price pattern, not wrongdoing, and the UI says exactly that.

Small samples are shown honestly: with fewer than 5 scored picks the site says "2 of 3", not "67%".

## Run it locally

Two terminals, about two minutes. Works on Windows, macOS and Linux, with **no API keys**: it serves the saved results in `backend/data`.

**1. API** (from the repo root, Python 3.10+):
```bash
pip install -r requirements.txt
python -m uvicorn api.index:app --port 8000
```

**2. Website** (Node 20+):
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/receipts**.

### Live checks and new audits (optional)

Create `backend/.env` with your keys and restart the API:

```
SERPAPI_API_KEY=your-serpapi-key
GROQ_API_KEYS=your-groq-key
```

Now open any creator Receipts hasn't checked, e.g. http://localhost:5173/receipts/c/Market%20Gurukul, and press **Run live check**. It searches YouTube, pulls transcripts, reads every tip and scores it, in about a minute, using at most 6 searches.

| Variable | Default | Purpose |
|---|---|---|
| `SERPAPI_API_KEY` | none | Your SerpApi key |
| `GROQ_API_KEYS` | none | Groq key(s) for reading transcripts (comma-separated) |
| `SERPAPI_MONTHLY_BUDGET` | 200 | Hard cap on real SerpApi calls per month |
| `LIVE_MAX_CALLS` | 6 | Searches a single live check may use |
| `LIVE_RESERVE` | 15 | Live checks pause when SerpApi's remaining balance drops below this |
| `LIVE_COOLDOWN_S` | 180 | Seconds between live checks per visitor |

Full audits (more videos, Google Finance prices, SEBI and news lookups) can be run from the API:
```bash
curl "http://127.0.0.1:8000/api/receipts/channel?name=Channel%20Name&max_videos=4"
```

### Tests
```bash
cd backend && python -m pytest -q        # needs backend/requirements.txt + pytest
cd frontend && npm test
```
They also run on every push (the CI badge above).

## Project layout

```
backend/app/services/receipts/   SerpApi client, YouTube, extraction, tickers, prices, scoring, pump check, SEBI
backend/app/routers/receipts.py  API routes (/api/receipts/...)
backend/data/                    Saved SerpApi responses, extractions and finished reports
frontend/src/receipts/           The Receipts site (React + TypeScript)
api/index.py                     The Receipts API (Vercel function, and the local server)
docs/watchlist/                  design notes for the watchlist pages
```

## Limits, stated plainly

- **Coverage:** a handful of creators are fully audited, because a full audit costs 15 to 30 SerpApi searches on a 250-a-month plan. Anyone can run a smaller live check on another creator.
- **Sample size:** a few videos per creator is a record, not a rating. A creator can look good or bad by luck.
- **Interim orders are allegations.** Scam watch labels each case as an interim order, final order or regulator action.
- **Transcripts:** auto-generated captions can be wrong, which is why every claim links to the exact second of the video.

## AI tools used

- **At runtime:** Groq-hosted `openai/gpt-oss-120b` (fallback `gpt-oss-20b`) extracts stock claims from transcripts. Everything after that, including verification, scoring and the pump check, is deterministic code.
- **While building:** Claude Code (Anthropic) helped write and refactor code, and design the UI. All design decisions, data sources and scoring rules were reviewed and chosen by me.

## Image credits

- BSE building, Dalal Street: BSEINDIA, CC BY-SA 3.0, via Wikimedia Commons
- SEBI Bhavan: Jimmy vikas, CC BY-SA 3.0, via Wikimedia Commons
- Arshad Warsi: Bollywood Hungama, CC BY 3.0, via Wikimedia Commons
- Jane Street logo: public domain, via Wikimedia Commons
- Creator avatars are loaded from their public YouTube channels.
