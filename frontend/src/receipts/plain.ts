// Plain-language wording, in one place. Written for someone who has never
// bought a share: no "Nifty", "alpha" or "30D" without saying what it means.

import { pct } from "./format";

export const MARKET = "the market";
export const MARKET_EXPLAINER =
  "“The market” here means the Nifty 50: India's 50 biggest companies taken together. It's what you'd get by not picking stocks at all. A tip counts as good only if it did better than that. A stock can lose money and still beat a market that lost more.";

export const VERDICT: Record<string, { label: string; good: boolean }> = {
  beat_market: { label: "Better than the market", good: true },
  lagged_market_as_called: { label: "Warning was right", good: true },
  lagged_market: { label: "Worse than the market", good: false },
  beat_market_against_call: { label: "Warning was wrong", good: false },
};

export const sayDirection = (d: string) =>
  ({ buy: "Said buy", sell: "Said sell", avoid: "Said avoid", hold: "Said hold", watch: "Just mentioned" })[d] ?? d;

const abs = (n: number) => `${Math.abs(n).toFixed(1)}%`;

// One sentence a beginner can read: what happened, and why it counts or not.
export function storyOf(ret: number | null, mkt: number | null, direction: string): string | null {
  if (ret == null || mkt == null) return null;
  const stock = ret >= 0 ? `went up ${abs(ret)}` : `went down ${abs(ret)}`;
  const market = mkt >= 0 ? `the market went up ${abs(mkt)}` : `the market went down ${abs(mkt)}`;
  if (direction === "sell" || direction === "avoid") {
    return ret < mkt
      ? `They said stay away. It ${stock} while ${market}, so the warning was right.`
      : `They said stay away. It ${stock} while ${market}, so the warning was wrong.`;
  }
  if (ret >= mkt) {
    if (ret >= 0 && mkt < 0) return `A month later it ${stock}, while the market fell ${abs(mkt)}.`;
    return ret >= 0
      ? `A month later it ${stock}, more than the market's ${abs(mkt)}.`
      : `A month later it ${stock}. But the market fell ${abs(mkt)}, so it still did better than average.`;
  }
  return ret >= 0
    ? `A month later it ${stock}, but ${market}. Doing nothing would have done better.`
    : `A month later it ${stock}, while ${market}.`;
}

// "If you'd put ₹10,000 in" makes a percentage feel real
export const onTenK = (ret: number) => {
  const end = Math.round(10000 * (1 + ret / 100));
  return `₹10,000 → ₹${end.toLocaleString("en-IN")}`;
};

export { pct };
