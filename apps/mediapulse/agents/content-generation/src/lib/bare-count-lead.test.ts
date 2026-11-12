import { describe, expect, it } from "vitest";

import { opensWithBareCount } from "./bare-count-lead.js";

describe("opensWithBareCount", () => {
  it("flags the bare counts shipped in the EXCL newsletter on 2026-11-12", () => {
    // Assert
    expect(
      opensWithBareCount(
        "The two: Telkominfra into Telkom Akses, and Nusantara Sukses Investasi into Graha Sarana Duta.",
      ),
    ).toBe(true);
    expect(
      opensWithBareCount(
        "The two: an AI system to detect online gambling promotion content, and a telecommunications tower registration system.",
      ),
    ).toBe(true);
    expect(
      opensWithBareCount(
        "The two: connected phones down 19 million to 311 million, social media up 60 million to 240 million accounts.",
      ),
    ).toBe(true);
  });

  it("flags a bare count written in digits", () => {
    // Assert
    expect(
      opensWithBareCount("The 14: SIDO, UNTR, JPFA, PTPS, CNMA and SMSM."),
    ).toBe(true);
    expect(opensWithBareCount("the 83: MPRO, DCII, BBSI and PGUN.")).toBe(true);
  });

  it("passes a count that sits inside a full sentence", () => {
    // Assert
    expect(
      opensWithBareCount(
        "The two mergers require approval from each company's EGMS and the Ministry of Law.",
      ),
    ).toBe(false);
    expect(
      opensWithBareCount(
        "Four state firms will receive the funds: Pertamina, PLN, Pupuk Indonesia and ID Food.",
      ),
    ).toBe(false);
  });

  it("passes a label that names what the items are", () => {
    // Assert
    expect(
      opensWithBareCount(
        "The three pillars: downstreaming, food security and energy transition.",
      ),
    ).toBe(false);
    expect(
      opensWithBareCount(
        "OJK: bank credit grew 7.7% year on year in September.",
      ),
    ).toBe(false);
  });
});
