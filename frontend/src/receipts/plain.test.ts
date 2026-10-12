import { describe, expect, it } from "vitest";
import { onTenK, storyOf, VERDICT } from "./plain";

describe("storyOf", () => {
  it("stock up, market down", () => {
    expect(storyOf(12.2, -5.1, "buy")).toBe("A month later it went up 12.2%, while the market fell 5.1%.");
  });
  it("both up, stock more", () => {
    expect(storyOf(8, 3, "buy")).toBe("A month later it went up 8.0%, more than the market's 3.0%.");
  });
  it("lost money but beat a falling market", () => {
    expect(storyOf(-4, -5.1, "buy")).toBe("A month later it went down 4.0%. But the market fell 5.1%, so it still did better than average.");
  });
  it("rose but trailed a rising market", () => {
    expect(storyOf(1.2, 2.5, "buy")).toContain("Doing nothing would have done better");
  });
  it("sell call that was right", () => {
    expect(storyOf(-10, 2, "sell")).toContain("the warning was right");
  });
  it("no data", () => {
    expect(storyOf(null, 1, "buy")).toBeNull();
  });
});

describe("onTenK and verdicts", () => {
  it("converts a percentage to rupees", () => {
    expect(onTenK(23.6)).toBe("₹10,000 → ₹12,360");
    expect(onTenK(-9.4)).toBe("₹10,000 → ₹9,060");
  });
  it("never says a losing tip 'paid off'", () => {
    expect(Object.values(VERDICT).map((v) => v.label).join(" ")).not.toMatch(/paid off/i);
  });
});

import { cleanTitle } from "./data";
describe("cleanTitle", () => {
  it("drops channel taglines and emoji", () => {
    expect(cleanTitle("Pushkar Raj Thakur: Stock Market Educator 📈")).toBe("Pushkar Raj Thakur");
    expect(cleanTitle("Avadhut Sathe Trading Academy")).toBe("Avadhut Sathe Trading Academy");
  });
});

import { wilsonLower } from "./data";
describe("ranking", () => {
  it("a big record outranks a lucky small one", () => {
    expect(wilsonLower(9, 17)).toBeGreaterThan(wilsonLower(2, 3));
    expect(wilsonLower(7, 9)).toBeGreaterThan(wilsonLower(9, 17));
  });
});
