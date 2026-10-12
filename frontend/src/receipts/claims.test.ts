import { describe, expect, it } from "vitest";
import type { ChannelReport } from "./api";
import { claimsFromChannel } from "./claims";

const call = {
  company: "Infosys",
  direction: "buy",
  explicit: true,
  target_price: null,
  stop_loss: null,
  horizon: null,
  quote: "buy Infosys",
  line: "buy Infosys",
  start_s: 12,
  ticker: null,
  video_id: "v1",
  video_title: "Stocks",
  video_url: "https://youtu.be/v1",
  timestamp_url: "https://youtu.be/v1?t=12",
  call_date: "2026-08-01",
  date_uncertainty_days: 0,
  score: {
    outcome: "beat_market",
    horizons: {
      "7": { status: "done", stock_return_pct: -1, nifty_return_pct: 1, right: false },
      "30": { status: "done", stock_return_pct: 5, nifty_return_pct: 1, right: true },
      "90": { status: "pending" },
    },
  },
};

describe("time windows", () => {
  it("judges the same tip after 1 week, 1 month and 3 months", () => {
    const [c] = claimsFromChannel({ videos: [], calls: [call] } as unknown as ChannelReport);
    expect(c.windows.map((w) => [w.label, w.status, w.right])).toEqual([
      ["1 week", "done", false],
      ["1 month", "done", true],
      ["3 months", "pending", null],
    ]);
  });
});
