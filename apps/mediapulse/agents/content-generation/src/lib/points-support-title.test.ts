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

  it("rejects the AADI item bridged to its heading only by the word investors", () => {
    const supported = pointsSupportTitle(
      "IHSG Predicted to Strengthen, Retail Investors Can Watch Stocks AADI, ANTM, and VKTR",
      [
        "Investors await Bank Indonesia's BI Rate decision, expected to remain at 5.75%",
      ],
    );

    expect(supported).toBe(false);
  });

  it("keeps the item beside it, whose bullet names the heading's real subjects", () => {
    const supported = pointsSupportTitle(
      "IHSG Rises 0.75% to Level 6,449 Fueled by BYAN Shares",
      [
        "Energy stocks, especially BYAN, drove the IHSG increase on that day",
        "Investors awaited interest rate decisions and foreign debt data",
      ],
    );

    expect(supported).toBe(true);
  });

  it("keeps a short translated heading sharing only its issuer name with its bullet", () => {
    const supported = pointsSupportTitle("FORE Delays Singapore Expansion", [
      "Fore Coffee postponed its Singapore rollout on cost grounds.",
    ]);

    expect(supported).toBe(true);
  });

  it("bridges a heading and its bullet on a three-letter ticker", () => {
    const supported = pointsSupportTitle("BRI shares rise on foreign buying", [
      "BRI shares closed higher on the day",
    ]);

    expect(supported).toBe(true);
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
