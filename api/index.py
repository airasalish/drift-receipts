"""The Receipts API: the Vercel function, and the easiest way to run it locally.

    pip install -r requirements.txt
    python -m uvicorn api.index:app --port 8000

Serves only the Receipts routes (no database, no background jobs). It runs
on the saved results in backend/data by default (SERPAPI_OFFLINE=1), so it
works with no API keys and browsing never spends SerpApi searches. Put
SERPAPI_API_KEY and GROQ_API_KEYS in backend/.env to enable live checks.
"""

import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

try:  # local runs: pick up backend/.env if it exists (never present on Vercel)
    from dotenv import load_dotenv

    load_dotenv(ROOT / "backend" / ".env")
except ImportError:
    pass
os.environ.setdefault("SERPAPI_OFFLINE", "1")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.routers.receipts import router as receipts_router  # noqa: E402

app = FastAPI(title="Receipts API")
# the Vite dev server (localhost:5173) calls this API on another port
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(receipts_router)


@app.get("/api/health")
def health():
    return {"ok": True, "offline": os.environ["SERPAPI_OFFLINE"]}
