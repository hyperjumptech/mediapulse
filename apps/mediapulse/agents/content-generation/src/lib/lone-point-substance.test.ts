/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { lonePointLacksFact } from "./lone-point-substance";

describe("lonePointLacksFact", () => {
  it.each([
    "The move supports nickel downstreaming and the supply chain for electric vehicle batteries.",
    "Growing data center investments in industrial areas increase demand for land, electricity, and water",
    "The cooperation focuses on strengthening artificial intelligence-based cybersecurity solutions.",
    "Profit growth was supported by loan growth and lower funding costs.",
    "This move refocuses attention on affordable access to medicines for patients.",
  ])("flags a lone point stating a purpose: %s", (point) => {
    expect(lonePointLacksFact([point])).toBe(true);
  });

  it.each([
    "TOMORO COFFEE launched the Master S.O.E Series Yirgacheffe Ethiopia, a new single-origin coffee line.",
    "MoraRepublic and Huawei Indonesia signed an MoU to strengthen collaboration in Indonesia's corporate ICT market.",
    "PT TBS Energi Utama Tbk (TOBA)'s electric vehicle business has begun recording profit.",
    "Foreign investors suddenly bought Bank Central Asia (BBCA) shares on the cum dividend date.",
  ])("leaves a lone point reporting an event alone: %s", (point) => {
    expect(lonePointLacksFact([point])).toBe(false);
  });

  it("leaves a purpose framing alone when it carries a figure", () => {
    expect(
      lonePointLacksFact([
        "The programme aims to add 5 million customers by 2030.",
      ]),
    ).toBe(false);
  });

  it("applies only to a lone point", () => {
    expect(
      lonePointLacksFact([
        "The move supports nickel downstreaming across Sulawesi.",
        "Vale will run three HPAL smelters.",
      ]),
    ).toBe(false);
  });

  it("returns false for an empty item", () => {
    expect(lonePointLacksFact([])).toBe(false);
  });
});
