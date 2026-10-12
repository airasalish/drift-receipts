"""Add an English translation (`quote_en`) to every non-English quote in the
saved reports, so the public site can show it without an API key.

The original quote is never changed -- it's the evidence, checked against the
transcript. The translation is display-only and labelled as such in the UI.

    python -m scripts.translate_quotes
"""
import json
import pathlib
import re

from dotenv import load_dotenv
from groq import Groq

from app.services.receipts.extraction import MODELS, _keys

load_dotenv()
REPORTS = pathlib.Path(__file__).resolve().parents[1] / "data" / "receipts_reports"
NON_LATIN = re.compile(r"[ऀ-෿]")  # Devanagari through Tamil/Telugu/Kannada/Malayalam

PROMPT = (
    "Translate this sentence from an Indian finance YouTube video into plain English. "
    "Keep company names as they are. Reply with the translation only, no quotes, no notes."
)


def translate(text: str) -> str | None:
    for key in _keys():
        for model in MODELS:
            try:
                resp = Groq(api_key=key).chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": PROMPT}, {"role": "user", "content": text}],
                    temperature=0,
                    max_tokens=200,
                )
                out = (resp.choices[0].message.content or "").strip().strip('"“”')
                if out:
                    return out
            except Exception as exc:  # try the next model/key
                print("  translate failed:", type(exc).__name__)
    return None


def items(report: dict):
    yield from report.get("calls", [])
    for v in report.get("videos", []):
        yield from v.get("mentions", []) or []


def main():
    done = 0
    for path in sorted(REPORTS.glob("*.json")):
        report = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for it in items(report):
            q = it.get("quote") or ""
            if NON_LATIN.search(q) and not it.get("quote_en"):
                en = translate(q)
                if en:
                    it["quote_en"] = en
                    changed = True
                    done += 1
                    print(f"{path.name}: {q[:40]} -> {en[:60]}")
        if changed:
            path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print("translated", done)


if __name__ == "__main__":
    main()
