import { describe, expect, it } from "vitest";

import { pointsSupportTitle } from "./points-support-title.js";

describe("pointsSupportTitle", () => {
  it("rejects the BBCA item whose bullets were about a different story than its heading", () => {
    const supported = pointsSupportTitle(
      "Prabowo Sends a Firm Message to Bank Indonesia: We Must Work as One Team",
      [
        "62,000 subsidised mortgages and Rp880 billion microcredit signed to boost housing delivery",
      ],
    );

    expect(supported).toBe(false);
  });

  it("keeps an item whose points echo its heading", () => {
    const supported = pointsSupportTitle(
      "ACES Records Profit of Rp390.3 Billion in H1 2026",
      [
        "ACES net profit rose 33.3% to Rp390.3 billion in H1 2026.",
        "Net sales grew 6.3% to Rp4.5 trillion with 2.2% same store sales growth.",
      ],
    );

    expect(supported).toBe(true);
  });

  it("keeps an item where only one point echoes the heading", () => {
    const supported = pointsSupportTitle(
      "Bank Raya (AGRO) Posts Rp12.01 Billion Profit in Q2/2026",
      [
        "CASA ratio reached 38.09%, up from 29.72% a year earlier.",
        "Bank Raya's net profit reached Rp12.01 billion in Q2/2026.",
      ],
    );

    expect(supported).toBe(true);
  });

  it("keeps a heading carrying no distinctive tokens, which cannot be tested", () => {
    expect(pointsSupportTitle("On the up", ["Revenue rose 12%."])).toBe(true);
  });

  it("keeps an item with no points, which the caller has already rejected", () => {
    expect(
      pointsSupportTitle("ACES Records Profit of Rp390.3 Billion", []),
    ).toBe(true);
  });

  it("matches on a shared company name even when the rest of the wording differs", () => {
    const supported = pointsSupportTitle(
      "Vale Indonesia on Track to Meet Nickel Production Target",
      ["Vale expects 2026 output to land inside its guided range."],
    );

    expect(supported).toBe(true);
  });
});
