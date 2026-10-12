"""Transcript -> stock calls. The one place an LLM makes a judgement in Receipts.

The model reads the transcript in its original language (Hindi, Hinglish,
English) and lists explicit recommendations. It is never trusted on its own:

- Every call must carry a verbatim quote, and that quote is checked against
  the transcript lines around the timestamp the model claimed. A call whose
  quote can't be found is dropped and counted as `rejected_unverified` --
  a hallucinated "he said BUY" is the single worst thing this product could
  show, so it's filtered out deterministically rather than prompted away.
- The model only proposes a company *name*. Turning that into a real ticker
  is done against an actual listing index (tickers.py), same principle as
  routers/symbols.py: don't ask a model for a fact a real source can give.
- Vague mentions ("keep an eye on banks") are kept as `watch` and never
  scored -- only explicit buy/sell calls count towards the report card.
"""

import difflib
import hashlib
import json
import logging
import os
import pathlib
import re
import time
import unicodedata

from groq import Groq

logger = logging.getLogger(__name__)

MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
CHUNK_CHARS = 6000
DIRECTIONS = {"buy", "sell", "hold", "avoid", "watch"}

SYSTEM_PROMPT = """You extract stock recommendations from Indian finance YouTube transcripts.
The transcript may be Hindi (Devanagari), Hinglish or English. Each line starts with [m:ss].

Return JSON: {"calls": [...]} where each call is:
{
  "company": English company name as commonly listed in India (transliterate Hindi, e.g. "टाटा मोटर्स" -> "Tata Motors"),
  "symbol_guess": NSE symbol if you are confident, else null,
  "direction": "buy" | "sell" | "hold" | "avoid" | "watch",
  "target_price": number in rupees or null,
  "stop_loss": number in rupees or null,
  "horizon": short text like "6 months" or null,
  "timestamp": the [m:ss] of the line where the call is made, e.g. "4:12",
  "quote": a short phrase copied EXACTLY, character for character, from that line (original script, do not translate),
  "explicit": true only if the speaker clearly tells viewers to buy/sell/avoid this specific stock (or gives a target price for it),
  "evidence": ["the specific words that made you decide the direction, each copied EXACTLY from the transcript or the video title",
               e.g. "buy", "target 500", "next company is", "Best Stocks to Buy Now" -- 1 to 3 short phrases],
  "reason": one plain-English sentence explaining the classification, e.g. "The title presents the video as stocks to buy and the speaker introduces this as the second pick."
}

Rules:
- Only specific listed companies. Not sectors, indices, mutual funds, or the market in general.
- "buy" includes "accumulate", "add", "invest", "खरीद", "ले सकते हैं" when said about that stock as advice.
- List EVERY specific company the speaker discusses or presents as a pick, even briefly. Many videos present
  several picks one after another ("अगली कंपनी है ..." / "next company is ...") -- each one is an entry.
- The video title is given first. If the title frames the video as stock picks to buy (e.g. "Best Stocks to Buy
  Now", "Multibagger stocks", "Stocks for the next bull run", "Undervalued stocks to buy"), then EVERY company the
  video presents as one of its picks is "buy" (explicit=false unless the speaker directly tells viewers to buy it).
- Use "watch" only for companies mentioned in passing: used as an example, a comparison, a peer, a customer,
  or a stock the speaker explicitly says is not a pick.
- Auto-generated captions misspell names; infer the real company from context (e.g. "assembles for Xiaomi" -> Dixon Technologies).
- Always give the FULL company name the context implies, never a fragment that names a different company:
  "Idea ... drones" -> "ideaForge Technology" (not Vodafone Idea); "lens card" -> "Lenskart Solutions".
- One entry per stock per distinct recommendation. Never invent a stock, number, or quote that is not in the text.
- If there are no stock calls, return {"calls": []}."""


def _keys() -> list[str]:
    return [k.strip() for k in os.getenv("GROQ_API_KEYS", "").split(",") if k.strip()]


def _fmt_ts(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


def _parse_ts(text: str | None) -> int | None:
    m = re.match(r"^\s*\[?(\d+):(\d{2})(?::(\d{2}))?\]?\s*$", str(text or ""))
    if not m:
        return None
    a, b, c = int(m.group(1)), int(m.group(2)), m.group(3)
    return a * 3600 + b * 60 + int(c) if c is not None else a * 60 + b


def _chunks(segments: list[dict]) -> list[list[dict]]:
    chunks, cur, size = [], [], 0
    for s in segments:
        line_len = len(s["text"]) + 8
        if cur and size + line_len > CHUNK_CHARS:
            chunks.append(cur)
            cur, size = cur[-2:], sum(len(x["text"]) + 8 for x in cur[-2:])  # small overlap so a call split across a boundary isn't lost
        cur.append(s)
        size += line_len
    if cur:
        chunks.append(cur)
    return chunks


class AIUnavailable(RuntimeError):
    """Every Groq key was rejected: report it, rather than "no tips found"."""


def _llm_json(user_text: str) -> dict | None:
    """Try each model x key; back off once on rate limits (free-tier Groq)."""
    tried = rejected = 0
    for model in MODELS:
        for key in _keys():
            for attempt in range(2):
                try:
                    resp = Groq(api_key=key).chat.completions.create(
                        model=model,
                        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_text}],
                        response_format={"type": "json_object"},
                        temperature=0,
                        max_tokens=6000,
                        reasoning_effort="medium",  # low missed most picks in a 6-stock Hindi video during testing
                        timeout=60,
                    )
                    return json.loads(resp.choices[0].message.content or "{}")
                except Exception as exc:
                    msg = str(exc).lower()
                    if "rate" in msg or "429" in msg:
                        if attempt == 0:
                            time.sleep(3)
                            continue
                    logger.warning("extraction failed on %s: %s", model, type(exc).__name__)
                    tried += 1
                    rejected += type(exc).__name__ in ("AuthenticationError", "PermissionDeniedError")
                    break
    if tried and rejected == tried:
        raise AIUnavailable("The AI that reads transcripts rejected its API key, so this check couldn't read any videos.")
    return None


def _norm(text: str) -> str:
    # strip punctuation/symbols by Unicode category rather than \w -- \w
    # doesn't match Devanagari vowel signs, so a regex would shred Hindi words
    text = unicodedata.normalize("NFKC", text).lower()
    text = "".join(" " if unicodedata.category(ch)[0] in "PS" and ch not in "₹%." else ch for ch in text)
    return " ".join(text.split())


def verify_quote(quote: str, ts: int | None, segments: list[dict], window_s: int = 45) -> dict | None:
    """Find the quote in the transcript near the claimed timestamp.

    Returns the matching segment (its real timestamp wins over the model's),
    or None if the quote isn't there. Fuzzy (>= 0.8) only to absorb
    punctuation/spacing differences between the model's copy and the source --
    not to forgive paraphrase.
    """
    q = _norm(quote or "")
    if len(q) < 4:
        return None
    near = [s for s in segments if ts is None or abs(s["start_s"] - ts) <= window_s] or segments
    best, best_score = None, 0.0
    for i, s in enumerate(near):
        # a quote can straddle two caption lines
        text = _norm(s["text"] + " " + (near[i + 1]["text"] if i + 1 < len(near) else ""))
        if q in text:
            return s
        m = difflib.SequenceMatcher(None, q, text).find_longest_match(0, len(q), 0, len(text))
        score = m.size / len(q)
        if score > best_score:
            best, best_score = s, score
    return best if best_score >= 0.8 else None


PROMPT_VERSION = hashlib.sha1((SYSTEM_PROMPT + "|".join(MODELS)).encode()).hexdigest()[:8]
EXTRACTIONS_DIR = pathlib.Path(__file__).resolve().parents[3] / "data" / "extractions"


def extract_calls_cached(video_id: str, segments: list[dict], title: str | None = None) -> dict:
    """LLM output varies run to run, so an audit must not change every time
    it's refreshed. Each video's extraction is stored per prompt version and
    reused until the prompt itself changes -- reproducible, and free to re-run."""
    path = EXTRACTIONS_DIR / f"{video_id}_{PROMPT_VERSION}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    result = extract_calls(segments, title)
    if result["llm_failed_chunks"] == 0:  # never freeze a partial result
        try:
            EXTRACTIONS_DIR.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
        except OSError:  # read-only host (Vercel live check): the result is still returned
            pass
    return result


def extract_calls(segments: list[dict], title: str | None = None) -> dict:
    """{'calls': [...verified...], 'rejected_unverified': n, 'chunks': n, 'llm_failed_chunks': n}

    The title matters: "6 Stocks to Buy Now" makes each presented company a
    pick even when the speaker never literally says "buy" in that sentence.
    """
    calls, rejected, failed = [], 0, 0
    chunks = _chunks(segments)
    for chunk in chunks:
        text = f"Video title: {title or '(unknown)'}\n\n" + "\n".join(
            f"[{_fmt_ts(s['start_s'])}] {s['text']}" for s in chunk)
        data = _llm_json(text)
        if data is None:
            failed += 1
            continue
        for c in data.get("calls", []) or []:
            direction = str(c.get("direction", "")).lower().strip()
            company = str(c.get("company") or "").strip()
            if direction not in DIRECTIONS or not company:
                continue
            seg = verify_quote(c.get("quote", ""), _parse_ts(c.get("timestamp")), chunk)
            if seg is None:
                rejected += 1
                continue
            evidence = _verified_evidence(c.get("evidence"), seg, chunk, title)
            calls.append({
                "company": company,
                "symbol_guess": (c.get("symbol_guess") or None),
                "direction": direction,
                "explicit": bool(c.get("explicit")) and direction != "watch",
                "target_price": _num(c.get("target_price")),
                "stop_loss": _num(c.get("stop_loss")),
                "horizon": c.get("horizon") or None,
                "quote": c.get("quote"),
                "start_s": seg["start_s"],
                "line": seg["text"],
                "evidence": evidence,
                "reason": str(c.get("reason") or "").strip()[:300] or None,
            })
    return {"calls": _dedupe(calls), "rejected_unverified": rejected, "chunks": len(chunks), "llm_failed_chunks": failed}


def _verified_evidence(raw, seg: dict, chunk: list[dict], title: str | None) -> list[dict]:
    """Keep only trigger phrases that really appear -- in the quoted line, its
    neighbours, or the title -- so the 'why' shown to users is as checked as
    the quote itself. Each kept phrase says where it was found."""
    if not isinstance(raw, list):
        raw = [raw] if raw else []
    near = [s for s in chunk if abs(s["start_s"] - seg["start_s"]) <= 30]
    out = []
    for phrase in raw[:3]:
        p = _norm(str(phrase or ""))
        if len(p) < 2:
            continue
        if title and p in _norm(title):
            out.append({"text": str(phrase), "where": "title"})
            continue
        hit = next((s for s in near if p in _norm(s["text"])), None)
        if hit:
            out.append({"text": str(phrase), "where": "transcript", "start_s": hit["start_s"]})
    return out


def _num(x) -> float | None:
    try:
        v = float(str(x).replace(",", "").replace("₹", "").strip())
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _dedupe(calls: list[dict]) -> list[dict]:
    """Same stock + same direction in one video = one call (earliest
    timestamp, but keep a target price if any repeat mentioned one).
    Overlapping chunks make repeats expected, not an edge case."""
    seen: dict[tuple, dict] = {}
    for c in sorted(calls, key=lambda c: c["start_s"]):
        k = (c["company"].lower(), c["direction"])
        if k not in seen:
            seen[k] = c
        else:
            kept = seen[k]
            kept["target_price"] = kept["target_price"] or c["target_price"]
            kept["stop_loss"] = kept["stop_loss"] or c["stop_loss"]
            kept["explicit"] = kept["explicit"] or c["explicit"]
            kept["evidence"] = kept.get("evidence") or c.get("evidence")
            kept["reason"] = kept.get("reason") or c.get("reason")
    return list(seen.values())
