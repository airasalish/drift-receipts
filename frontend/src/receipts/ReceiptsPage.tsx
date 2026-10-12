import { useEffect } from "react";
import { Link, Navigate, NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { About } from "./About";
import { CaseStudy } from "./CaseStudy";
import { creatorPath, stockPath } from "./data";
import { CreatorPage, CreatorsPage, HomePage, StockPage, StocksPage } from "./Pages";
import { Watchlists } from "./Watchlists";
import "./Receipts.css";
import "./Editorial.css";
import "./EvidenceMap.css";
import "./Dashboard.css";
import "./Receipts2.css";

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="rc-logo">
      <path d="M5 2h14v20l-2.3-1.6L14.3 22 12 20.4 9.7 22l-2.4-1.6L5 22z" fill="currentColor" opacity=".18" />
      <path d="M5 2h14v20l-2.3-1.6L14.3 22 12 20.4 9.7 22l-2.4-1.6L5 22z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 9.5l2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// old dashboard and per-page links
function LegacyRedirect() {
  const [params] = useSearchParams();
  const creator = params.get("creator") ?? params.get("channel");
  const stock = params.get("stock") ?? params.get("company");
  return <Navigate to={creator ? creatorPath(creator) : stock ? stockPath(stock) : "/receipts"} replace />;
}

export function ReceiptsPage() {
  useEffect(() => {
    if (!document.getElementById("rc-font")) {
      const link = Object.assign(document.createElement("link"), {
        id: "rc-font",
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      });
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="rc-shell rx2">
      <header className="nv">
        <Link className="nv-brand" to="/receipts">
          <ReceiptIcon />
          <span>Receipts</span>
        </Link>
        <nav className="nv-links" aria-label="Main">
          <NavLink to="/receipts" end>
            Home
          </NavLink>
          <NavLink to="/receipts/creators">Creators</NavLink>
          <NavLink to="/receipts/stocks">Stocks</NavLink>
          <NavLink to="/receipts/about">About</NavLink>
        </nav>
      </header>
      <main className="rc-main">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="creators" element={<CreatorsPage />} />
          <Route path="stocks" element={<StocksPage />} />
          <Route path="c/:name" element={<CreatorPage />} />
          <Route path="s/:name" element={<StockPage />} />
          <Route path="watchlists" element={<Watchlists />} />
          <Route path="sebi-case" element={<CaseStudy />} />
          <Route path="about" element={<About />} />
          {/* old links */}
          <Route path="investigate" element={<LegacyRedirect />} />
          <Route path="youtuber" element={<LegacyRedirect />} />
          <Route path="stock" element={<LegacyRedirect />} />
          <Route path="hype" element={<LegacyRedirect />} />
          <Route path="how-it-works" element={<Navigate to="/receipts/about" replace />} />
          <Route path="*" element={<Navigate to="/receipts" replace />} />
        </Routes>
      </main>
      <footer className="ft">
        <div className="ft-grid">
          <div className="ft-brand">
            <Link className="nv-brand" to="/receipts">
              <ReceiptIcon />
              <span>Receipts</span>
            </Link>
            <p>A public track record for stock tips on Indian finance YouTube.</p>
          </div>
          <nav aria-label="Explore">
            <b>Explore</b>
            <Link to="/receipts/creators">Creators</Link>
            <Link to="/receipts/stocks">Stocks</Link>
            <Link to="/receipts/watchlists">Watchlists</Link>
            <Link to="/receipts/sebi-case">The SEBI case</Link>
          </nav>
          <nav aria-label="About Receipts">
            <b>About</b>
            <Link to="/receipts/about">How it works</Link>
            <Link to="/receipts/about">What Receipts is not</Link>
            <a href="https://github.com/airasalish/receipts" target="_blank" rel="noreferrer">
              Source code
            </a>
          </nav>
          <nav aria-label="Data sources">
            <b>Data</b>
            <span>YouTube, via SerpApi</span>
            <span>Google Finance, via SerpApi</span>
            <span>Google News, via SerpApi</span>
            <span>Yahoo Finance</span>
          </nav>
        </div>
        <div className="ft-legal">
          <span>© 2026 Receipts. Not investment advice. Past performance doesn't predict future returns.</span>
          <span>Interim SEBI orders are allegations, not final findings.</span>
        </div>
      </footer>
    </div>
  );
}
