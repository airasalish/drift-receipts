"""Company name (as the LLM heard it) -> a real Indian listing.

Resolution is a lookup against Yahoo's listing search -- the same index
routers/symbols.py already trusts -- never the model's own symbol guess
taken at face value. The guess is only tried as a second query. A name that
doesn't resolve stays unresolved and unscored; the report card shows it as
such rather than pinning a call on the wrong company.

Yahoo symbols map onto Google Finance's format for the price lookup:
TATAMOTORS.NS -> TATAMOTORS:NSE, 540821.BO -> 540821:BOM.
"""

import difflib
import functools
import logging
import re

from app.services.receipts import yahoo

logger = logging.getLogger(__name__)

_SUFFIX_TO_GF = {".NS": "NSE", ".BO": "BOM"}
_NOISE = re.compile(r"\b(ltd|limited|india|industries|technologies|tech|co|corp|corporation|the)\b\.?", re.I)


def to_google_finance(yahoo_symbol: str) -> str | None:
    for suffix, exch in _SUFFIX_TO_GF.items():
        if yahoo_symbol.upper().endswith(suffix):
            return f"{yahoo_symbol[: -len(suffix)].upper()}:{exch}"
    return None


def _core(name: str) -> str:
    return " ".join(_NOISE.sub(" ", name.lower()).split())


_WORD = re.compile(r"[a-z0-9]+")
_FILLER = {"of", "and", "the", "ltd", "limited", "co", "company", "corp", "corporation", "india", "indian", "industries", "inc"}


def plausible(heard: str, listed_name: str, symbol: str) -> bool:
    """Does a listing actually look like the company the speaker named?

    Yahoo's search returns *something* for almost any query ("India Dynamics"
    came back as State Bank of India), so a match must share a real word with
    what was heard, or the heard name must be the ticker or its acronym.
    """
    heard_words = [w for w in _WORD.findall(heard.lower())]
    sig = [w for w in heard_words if w not in _FILLER and len(w) >= 3]
    listed = [w for w in _WORD.findall(listed_name.lower()) if w not in _FILLER]
    sym = re.sub(r"\.(ns|bo)$", "", symbol.lower())
    # same word, a prefix of it, or a close spelling ("Lalita" heard for "Lalithaa")
    if any(h == l or (len(h) >= 4 and (l.startswith(h) or h.startswith(l) or difflib.SequenceMatcher(None, h, l).ratio() >= 0.8))
           for h in sig for l in listed):
        return True
    joined = "".join(sig)
    initials = "".join(w[0] for w in heard_words if w not in {"ltd", "limited", "of", "and", "the"})
    if any(h == sym or (len(h) >= 3 and sym.startswith(h)) for h in sig) or (joined and sym.startswith(joined)):
        return True
    return len(initials) >= 2 and sym.startswith(initials)


@functools.lru_cache(maxsize=512)
def _search(query: str) -> tuple:
    return yahoo.search(query)


_SYMBOL_IN_TEXT = re.compile(r"\b(?:NSE|BSE)\s*:\s*([A-Z0-9&\-]{2,20})\b")


def resolve_via_search(company: str) -> dict | None:
    """Fallback for names auto-captions mangled ("Lalita Dwellers" for
    Lalithaa Jewellery). Google's own spelling correction and finance answer
    box do the fixing; the result still has to pass the same listing lookup
    as any other name. 1 SerpApi credit per name, cached for a month.
    """
    from app.services.receipts import serpapi_client as serp  # local import: keeps resolve() usable offline/in tests

    try:
        data = serp.search({"engine": "google", "q": f"{company} share price", "gl": "in", "hl": "en"},
                           max_age_hours=24 * 30)
    except (serp.BudgetExceeded, serp.SerpApiUnavailable):
        return None
    box = data.get("answer_box") or {}
    kg = data.get("knowledge_graph") or {}
    # Google's finance answer box *is* a listing lookup -- use it directly
    if box.get("type") == "finance_results" and box.get("stock") and box.get("exchange") in ("NSE", "BOM"):
        exch, code = box["exchange"], str(box["stock"]).strip()
        return {
            "yahoo_symbol": f"{code}.{'NS' if exch == 'NSE' else 'BO'}",
            "google_finance": f"{code}:{exch}",
            "name": kg.get("title") or company,
            "exchange": "NSE" if exch == "NSE" else "BSE",
            "resolved_via": "google_search",
            "search_query": company,
        }
    candidates: list[str] = []
    for r in data.get("organic_results", [])[:5]:  # e.g. "... (LTELEVATOR.BO)" in a Yahoo result title
        candidates += re.findall(r"\(([A-Z0-9&\-]{2,20}\.(?:NS|BO))\)", r.get("title", ""))
    if box.get("stock"):
        candidates.append(str(box["stock"]).split(":")[-1].strip())
    for text in [kg.get("title"),
                 (data.get("search_information") or {}).get("spelling_fix")]:
        if text:
            candidates.append(str(text))
    for r in data.get("organic_results", [])[:5]:
        blob = f"{r.get('title', '')} {r.get('snippet', '')}"
        candidates += _SYMBOL_IN_TEXT.findall(blob)
        title = r.get("title", "")
        if any(site in r.get("link", "") for site in ("nseindia", "bseindia", "moneycontrol", "screener.in", "groww.in")):
            candidates.append(re.split(r"\s[|\-–(]", title)[0])
    for cand in dict.fromkeys(c.strip() for c in candidates if c and c.strip()):
        hit = resolve(cand)
        if hit:
            return {**hit, "resolved_via": "google_search", "search_query": company}
    return None


def resolve(company: str, symbol_guess: str | None = None) -> dict | None:
    """Best Indian (NSE preferred, then BSE) equity listing for a company name, or None."""
    for query in [company, symbol_guess, _core(company)]:
        if not query:
            continue
        indian = [q for q in _search(query.strip())
                  if q.get("quoteType") == "EQUITY" and str(q.get("symbol", "")).upper().endswith((".NS", ".BO"))
                  and plausible(company, q.get("longname") or q.get("shortname") or "", q["symbol"])]
        if not indian:
            continue
        # closest name first ("Infosys" is Infosys Limited, not HCL Infosystems), then NSE over BSE
        heard = _core(company)
        indian.sort(key=lambda q: (-round(difflib.SequenceMatcher(None, heard, _core(q.get("longname") or q.get("shortname") or "")).ratio(), 2),
                                   0 if q["symbol"].upper().endswith(".NS") else 1))
        best = indian[0]
        return {
            "yahoo_symbol": best["symbol"],
            "google_finance": to_google_finance(best["symbol"]),
            "name": best.get("longname") or best.get("shortname") or company,
            "exchange": "NSE" if best["symbol"].upper().endswith(".NS") else "BSE",
        }
    return None
