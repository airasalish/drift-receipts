"""A free first look at any YouTuber, from the AI's general knowledge.

Before a live check spends SerpApi searches, ask the model whether the name
is a channel it knows, and whether that channel gives stock advice at all.
"MrBeast" doesn't need six searches to establish that he doesn't pick stocks.

This is labelled in the UI as the AI's general knowledge, not a checked
result: the only way to be sure is the real check, which stays one click away.
Anything the model isn't confident about goes straight to the real check.
"""
import json
import logging
import re

from groq import Groq

from app.services.receipts.extraction import MODELS, _keys

logger = logging.getLogger(__name__)

PROMPT = """You know popular YouTube creators. Given a name someone typed, say what you know about that YouTube channel.
Reply as JSON only:
{
  "known": true or false,                 // do you actually recognise this as a real YouTube creator/channel?
  "channel": "the channel's usual name, or null",
  "about": "one short plain sentence about what the channel makes, or null",
  "category": "finance" | "entertainment" | "gaming" | "tech" | "education" | "news" | "other" | "unknown",
  "gives_stock_tips": "often" | "sometimes" | "never" | "unknown",   // does it recommend specific stocks to buy or sell?
  "confidence": 0.0 to 1.0
}
If you are not sure who this is, set known=false, category="unknown", gives_stock_tips="unknown", confidence below 0.5. Never guess."""

_cache: dict[str, dict] = {}


def look_up(name: str) -> dict:
    key = re.sub(r"\s+", " ", name.strip().lower())
    if key in _cache:
        return _cache[key]
    out = {"known": False, "category": "unknown", "gives_stock_tips": "unknown", "confidence": 0.0, "about": None, "channel": None}
    for model in MODELS:
        for api_key in _keys():
            try:
                resp = Groq(api_key=api_key).chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": PROMPT}, {"role": "user", "content": name.strip()[:80]}],
                    response_format={"type": "json_object"},
                    temperature=0,
                    max_tokens=400,
                    timeout=20,
                )
                data = json.loads(resp.choices[0].message.content or "{}")
                out.update({k: data.get(k, out[k]) for k in out})
                try:
                    out["confidence"] = float(out["confidence"] or 0)
                except (TypeError, ValueError):
                    out["confidence"] = 0.0
                _cache[key] = out
                return out
            except Exception as exc:  # next key/model; never block the real check
                logger.warning("profile look-up failed on %s: %s", model, type(exc).__name__)
    return out


def skip_search(info: dict) -> bool:
    """Only skip the real check when the model clearly knows a non-finance channel."""
    return bool(info.get("known")) and info.get("gives_stock_tips") == "never" and info.get("category") != "finance" and float(info.get("confidence") or 0) >= 0.8
