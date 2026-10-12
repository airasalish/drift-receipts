"""Feasibility check for Receipts. Hard cap: 4 SerpApi credits. Every response is cached
in backend/data/serpapi_cache/, so re-running costs nothing."""
import hashlib
import json
import pathlib
import sys

import requests

BACKEND = pathlib.Path(__file__).resolve().parents[1]
CACHE = BACKEND / "data" / "serpapi_cache"
CACHE.mkdir(parents=True, exist_ok=True)
KEY = next((l.split("=", 1)[1].strip().strip("\"'") for l in (BACKEND / ".env").read_text(encoding="utf-8").splitlines()
            if l.startswith("SERPAPI_API_KEY=")), None)
spent = 0


def serp(**params):
    global spent
    tag = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()[:12]
    f = CACHE / f"{params['engine']}_{tag}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    if spent >= 4:
        sys.exit("credit cap reached")
    data = requests.get("https://serpapi.com/search.json", params={**params, "api_key": KEY}, timeout=90).json()
    spent += 1
    f.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    if "error" in data:
        print("  ! API error:", data["error"])
    return data


# 1. Google Finance: the SEBI pump-and-dump stock, 5-year history
d = serp(engine="google_finance", q="540821:BOM", window="5Y", hl="en")
g = d.get("graph", [])
print(f"\n[1] google_finance 540821:BOM -> {len(g)} graph points")
if g:
    print("    first:", g[0], "\n    last:", g[-1])
    pts_2022 = [p for p in g if "2022" in str(p.get("date"))]
    print(f"    points in 2022: {len(pts_2022)}; sample:", pts_2022[::max(1, len(pts_2022) // 8)][:8])
print("    summary:", d.get("summary", {}).get("title"), d.get("summary", {}).get("price"))

# 2. YouTube search for Indian stock-tip videos
d = serp(engine="youtube", search_query="multibagger stock to buy now", gl="in", hl="en")
vids = [v for v in d.get("video_results", []) if v.get("link")]
print(f"\n[2] youtube search -> {len(vids)} videos")
for v in vids[:8]:
    print("   ", v.get("channel", {}).get("name"), "|", v.get("title"), "|", v.get("published_date"), "|", v.get("length"))

# 3. Transcripts for the first two videos
for v in vids[:2]:
    vid = v["link"].split("v=")[-1].split("&")[0]
    d = serp(engine="youtube_video_transcript", v=vid)
    segs = d.get("transcript", [])
    langs = [t.get("language_code") or t.get("title") for t in d.get("available_transcripts", [])] if d.get("available_transcripts") else None
    print(f"\n[3] transcript {vid} -> {len(segs)} segments; available: {langs}")
    for s in segs[:6]:
        print("   ", s.get("start_time_text"), s.get("snippet"))

print(f"\nCredits spent this run: {spent}")
