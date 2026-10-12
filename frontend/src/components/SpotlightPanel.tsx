import { useEffect, useState } from 'react';
import { api, type SpotlightOut } from '../api';
import type { WatchlistItem } from '../types';
import './SpotlightPanel.css';

// Reveals a generated sentence a few characters at a time, purely as a
// presentational flourish -- the data behind it already finished loading,
// this never adds real latency. Fast on purpose (a full sentence finishes
// well under a second): a slow, dramatic typewriter would read as making
// the user wait for something that's actually already there.
function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, [text]);
  return <>{shown}</>;
}

export function SpotlightPanel({ item, watchlistId }: { item: WatchlistItem; watchlistId: number | null }) {
  const [spotlight, setSpotlight] = useState<SpotlightOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fetched separately from the main analysis, not blocking it -- this is a
  // short AI-generated synthesis of the verdicts above, not the analysis
  // itself. If it's slow, fails, or the keys are exhausted, the rest of the
  // panel (real numbers, already computed) is unaffected either way.
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (!watchlistId) {
      setSpotlight(null);
      return;
    }
    let cancelled = false;
    async function loadSpotlight() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.watchlists.spotlight(watchlistId!, item.symbol);
        if (!cancelled) setSpotlight(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Spotlight analysis');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSpotlight();
    return () => { cancelled = true; };
  }, [item.symbol, watchlistId]);

  useEffect(() => {
    if (!watchlistId) {
      setInsight(null);
      return;
    }
    let cancelled = false;
    setInsight(null);
    api.watchlists.spotlightInsight(watchlistId, item.symbol)
      .then((r) => { if (!cancelled) setInsight(r.insight); })
      .catch(() => { if (!cancelled) setInsight(null); });
    return () => { cancelled = true; };
  }, [item.symbol, watchlistId]);

  return (
    <div className="spotlight-panel">
      <div className="spotlight-header">
        <h3>Spotlight Analysis</h3>
        {item.has_attention && (
          <span className="spotlight-badge flagged" title="This stock has important signals">
            Flagged
          </span>
        )}
      </div>

      {loading && <div className="spotlight-loading">Analyzing {item.symbol}...</div>}
      {error && <div className="spotlight-error">{error}</div>}

      {spotlight && (
        <>
          {/* Attention Score */}
          <div className="spotlight-section">
            <div className="spotlight-label">Attention Score</div>
            <div className="attention-score">
              <div className="score-value">{spotlight.attention_score}/100</div>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${spotlight.attention_score}%` }} />
              </div>
            </div>
          </div>

          {/* Spotlight AI: one conversational sentence synthesizing the three
              verdicts below, not replacing them -- the labeled sections
              underneath are still the real, auditable analysis; this is
              just a readable front door to it, same "AI rephrases, rules
              decide" split as the digest feature elsewhere in the app. */}
          {insight && (
            <div className="spotlight-section spotlight-insight">
              <span className="ai-label">Spotlight AI</span>
              <p className="spotlight-insight-text"><TypewriterText text={insight} /></p>
            </div>
          )}

          {/* Why Interesting */}
          {spotlight.why_interesting.length > 0 && (
            <div className="spotlight-section">
              <div className="spotlight-label">Why Flagged</div>
              <ul className="why-list">
                {spotlight.why_interesting.map((reason, idx) => (
                  <li key={idx}><TypewriterText text={reason} /></li>
                ))}
              </ul>
            </div>
          )}

          {/* Self Analysis */}
          <div className="spotlight-section">
            <div className="spotlight-label">Self (vs own history)</div>
            <div className="analysis-block">
              <p><TypewriterText text={spotlight.self_analysis.context} /></p>
              <div className="data-grid">
                <div className="data-item">
                  <span className="data-label">Today</span>
                  <span className={`data-value ${spotlight.self_analysis.today_pct_change >= 0 ? 'positive' : 'negative'}`}>
                    {/* today_pct_change is a raw fraction from the backend
                        (0.025 == 2.5%), same convention as every other
                        *_pct field in this app -- must be *100 before
                        display, same as formatPct() does elsewhere. */}
                    {spotlight.self_analysis.today_pct_change >= 0 ? '+' : ''}{(spotlight.self_analysis.today_pct_change * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="data-item">
                  <span className="data-label">Normal move</span>
                  <span className="data-value">{(spotlight.self_analysis.normal_daily_move * 100).toFixed(2)}%</span>
                </div>
                {spotlight.self_analysis.volume_vs_normal > 0 && (
                  <div className="data-item">
                    <span className="data-label">Volume</span>
                    <span className="data-value">{spotlight.self_analysis.volume_vs_normal.toFixed(1)}× normal</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Peer Analysis -- the real numbers behind "outlier"/"with the pack"
              (how many peers, how many of them also moved unusually) are
              computed on the backend either way; showing them turns a vague
              adjective into evidence instead of leaving it invisible. */}
          <div className="spotlight-section">
            <div className="spotlight-label">Peer (vs watchlist)</div>
            <div className="analysis-block">
              <p><TypewriterText text={spotlight.peer_analysis.comparison} /></p>
              {spotlight.peer_analysis.watchlist_size > 1 && (
                <div className="data-grid">
                  <div className="data-item">
                    <span className="data-label">Peers also unusual</span>
                    <span className="data-value">{spotlight.peer_analysis.peers_unusual_count} of {spotlight.peer_analysis.watchlist_size - 1}</span>
                  </div>
                  <div className="data-item">
                    <span className="data-label">Avg peer move</span>
                    <span className={`data-value ${spotlight.peer_analysis.avg_peer_move >= 0 ? 'positive' : 'negative'}`}>
                      {spotlight.peer_analysis.avg_peer_move >= 0 ? '+' : ''}{(spotlight.peer_analysis.avg_peer_move * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
              {spotlight.peer_analysis.cluster && (
                <div className="cluster-note">
                  {spotlight.peer_analysis.cluster.symbols.length} {spotlight.peer_analysis.cluster.name} stocks {spotlight.peer_analysis.cluster.trend}
                </div>
              )}
            </div>
          </div>

          {/* Market Analysis */}
          <div className="spotlight-section">
            <div className="spotlight-label">Market (vs benchmark)</div>
            <div className="analysis-block">
              <p><TypewriterText text={spotlight.market_analysis.context} /></p>
              <div className="data-grid">
                <div className="data-item">
                  <span className="data-label">Nifty 50 today</span>
                  <span className={`data-value ${spotlight.market_analysis.benchmark_move >= 0 ? 'positive' : 'negative'}`}>
                    {spotlight.market_analysis.benchmark_move >= 0 ? '+' : ''}{(spotlight.market_analysis.benchmark_move * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="data-item">
                  <span className="data-label">Vs. benchmark</span>
                  <span className={`data-value ${spotlight.market_analysis.outperformance >= 0 ? 'positive' : 'negative'}`}>
                    {spotlight.market_analysis.outperformance >= 0 ? '+' : ''}{(spotlight.market_analysis.outperformance * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Note if exists */}
      {item.note && (
        <div className="spotlight-section">
          <div className="spotlight-label">Your Note</div>
          <div className="note-content">{item.note}</div>
        </div>
      )}
    </div>
  );
}
