import type { CaseStudy } from "./api";
import type { Note } from "./PriceVolumeChart";

export const rupees = (v: unknown) => `₹${Math.round(Number(v))}`;

// The three moments a non-investor needs to see on the real chart.
export function caseNotes(d: CaseStudy): Note[] {
  const m = d.pump_check.metrics;
  return [
    { date: String(d.pump_check.promotion_date_used), label: `① Videos start: ${rupees(m.price_at_promotion)}`, tone: "amber" },
    { date: String(m.peak_date), label: `② Peak: ${rupees(m.peak_price)}`, tone: "green" },
    { date: String(m.trough_date), label: `③ Crash: ${rupees(m.trough_after_peak)}`, tone: "red" },
  ];
}

// What ₹10,000 bought at the peak was worth at the bottom, rounded to ₹10.
export const tenKAtPeak = (d: CaseStudy) =>
  Math.round((10000 * Number(d.pump_check.metrics.trough_after_peak)) / Number(d.pump_check.metrics.peak_price) / 10) * 10;
