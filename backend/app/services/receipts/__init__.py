"""Receipts: audits YouTube stock tips against what the stock actually did.

Watchlist tells you *what* changed in a watchlist; Receipts tells you *who* was
talking about it beforehand and whether their past calls held up. Every
search-derived fact comes from SerpApi (YouTube, YouTube transcripts, Google
Finance, Google Search, Google News) -- see serpapi_client.py for the cache
and credit guard that keep this inside a 250-search free plan.
"""
