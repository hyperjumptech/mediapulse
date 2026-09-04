/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { statesImplausibleAggregate } from "./implausible-aggregate";

describe("statesImplausibleAggregate", () => {
  it("flags a seven-month national FX total stated in millions", () => {
    const point =
      "Bank Indonesia recorded foreign exchange market transactions of US$87.11 million in the first seven months of 2026, up 25.37% YoY.";

    expect(statesImplausibleAggregate(point)).toBe(true);
  });

  it("accepts the same aggregate stated in billions", () => {
    const point =
      "Bank Indonesia recorded foreign exchange market transactions of US$620 billion in the first seven months of 2026.";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });

  it("accepts a national aggregate in millions that clears the floor", () => {
    const point =
      "Bank Indonesia recorded market transactions of US$1,500 million in the first half of 2026.";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });

  it("leaves a component figure alone", () => {
    const point =
      "Option transactions surged 176.5% to US$1.39 million in the first seven months of 2026.";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });

  it("leaves a single-month national figure alone", () => {
    const point =
      "Bank Indonesia recorded banking credit of Rp 8,970.2 trillion in July, up 13% YoY";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });

  it("leaves one institution's own figure alone", () => {
    const point =
      "BBRI recorded a net profit of Rp30.9 trillion in the first half of 2026.";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });

  it("leaves a non-monetary national count alone", () => {
    const point =
      "XLSMART has 265,000 BTS nationwide serving 69 million customers in the first half of 2026.";

    expect(statesImplausibleAggregate(point)).toBe(false);
  });
});
