import { describe, expect, it } from "vitest";

import {
  buildSubjectFallback,
  buildSubjectPrompt,
  MAX_SUBJECT_LENGTH,
  newsletterSubjectSchema,
  resolveSubject,
  subjectRejection,
  SUBJECT_FALLBACK_TEXT,
  trimSubjectToBudget,
  truncateOnWordBoundary,
  WRITE_SUBJECT_SYSTEM_PROMPT,
} from "./write-subject.js";

describe("truncateOnWordBoundary", () => {
  it("returns text that already fits", () => {
    expect(truncateOnWordBoundary("GoTo swings to H1 2026 profit", 48)).toBe(
      "GoTo swings to H1 2026 profit",
    );
  });

  it("cuts on a word boundary rather than mid-word", () => {
    const title = "Bank Neo Commerce profits rise amid liquidity, MSME push";

    expect(truncateOnWordBoundary(title, MAX_SUBJECT_LENGTH)).toBe(
      "Bank Neo Commerce profits rise amid liquidity",
    );
  });

  it("strips punctuation left dangling by the cut", () => {
    expect(
      truncateOnWordBoundary(
        "Kalbe Farma Sales Reach Rp 19.47 Trillion in H1-2026 Results",
        MAX_SUBJECT_LENGTH,
      ),
    ).toBe("Kalbe Farma Sales Reach Rp 19.47 Trillion in");
  });

  it("never splits a multi-byte character", () => {
    const title = `${"a".repeat(MAX_SUBJECT_LENGTH - 1)}🙂 tail`;
    const result = truncateOnWordBoundary(title, MAX_SUBJECT_LENGTH);

    expect(result).not.toContain("�");
    expect([...result].every((char) => char.codePointAt(0) !== 0xdfe2)).toBe(
      true,
    );
  });

  it("falls back to the clipped span when there is no space to cut on", () => {
    const result = truncateOnWordBoundary("a".repeat(80), 10);

    expect(result).toBe("a".repeat(10));
  });
});

describe("buildSubjectFallback", () => {
  it("uses the lead headline when it is clean", () => {
    expect(
      buildSubjectFallback([
        "GoTo swings to H1 2026 profit",
        "Grab holds share in Indonesia",
      ]),
    ).toBe("GoTo swings to H1 2026 profit");
  });

  it("skips a headline carrying non-Latin script", () => {
    const titles = [
      "TBS Energi Utama Wins ESG 2026 Award on Coal to绿色 Infrastructure",
      "Indika Energy Revenue Grows 19.9%",
    ];

    expect(buildSubjectFallback(titles)).toBe(
      "Indika Energy Revenue Grows 19.9%",
    );
  });

  it("returns the generic subject when every headline is unusable", () => {
    expect(buildSubjectFallback(["安全生产月", "四半期決算"])).toBe(
      SUBJECT_FALLBACK_TEXT,
    );
  });

  it("returns the generic subject for an empty issue", () => {
    expect(buildSubjectFallback([])).toBe(SUBJECT_FALLBACK_TEXT);
  });

  it("never exceeds the subject budget", () => {
    const result = buildSubjectFallback([
      "Ministry of Energy and Mineral Resources Accommodates 2026 RKAB Revision in a Measured Way",
    ]);

    expect(result.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
    expect(result).toBe("Ministry of Energy and Mineral Resources");
  });
});

describe("buildSubjectPrompt — issuer context and sections", () => {
  it("names the issuer so the writer can tell its news from a competitor's", () => {
    const prompt = buildSubjectPrompt(
      [
        {
          title: "MAPI opens Ace Hardware store",
          section: "dealsAndMovements",
        },
      ],
      { symbol: "BABY", name: "PT Multitrend Indo Tbk." },
    );

    expect(prompt).toContain(
      "This issue is for BABY (PT Multitrend Indo Tbk.)",
    );
  });

  it("labels each headline with the section it landed in", () => {
    const prompt = buildSubjectPrompt(
      [
        { title: "ANTM H1 production rises", section: "issuerPerformance" },
        { title: "Vale Q2 profit up 39%", section: "competitiveLandscape" },
      ],
      { symbol: "ANTM" },
    );

    expect(prompt).toContain("- [issuerPerformance] ANTM H1 production rises");
    expect(prompt).toContain("- [competitiveLandscape] Vale Q2 profit up 39%");
  });

  it("omits the issuer line when no issuer identity is known", () => {
    const prompt = buildSubjectPrompt([{ title: "Coal price falls 1.25%" }]);

    expect(prompt).not.toContain("This issue is for");
    expect(prompt).toContain("- Coal price falls 1.25%");
  });

  it("still accepts bare title strings", () => {
    const prompt = buildSubjectPrompt(["Coal price falls 1.25%"], {
      symbol: "AADI",
    });

    expect(prompt).toContain("This issue is for AADI.");
    expect(prompt).toContain("- Coal price falls 1.25%");
  });
});

describe("newsletterSubjectSchema", () => {
  it("accepts a subject longer than the budget so the provider never truncates mid-word", () => {
    const long = "a".repeat(MAX_SUBJECT_LENGTH * 2);

    expect(newsletterSubjectSchema.parse({ subject: long }).subject).toBe(long);
  });
});

describe("trimSubjectToBudget", () => {
  it("drops a trailing function word left by the cut", () => {
    const cut =
      "Regulatory Moves Highlight Pharmacists' Role for Indonesian Pharma";

    expect(trimSubjectToBudget(cut)).toBe(
      "Regulatory Moves Highlight Pharmacists' Role",
    );
  });

  it("never returns a subject over the budget", () => {
    const overlong =
      "Pacific Universal Controls Gains Majority of MAPI Shares After Tender";
    const result = trimSubjectToBudget(overlong);

    expect(result.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
    expect(result).toBe("Pacific Universal Controls Gains Majority");
  });
});

describe("subjectRejection", () => {
  it("rejects a subject carrying non-Latin script", () => {
    expect(
      subjectRejection(
        "Telkom's H1 Revenue Rp75.9T with 6.2% Profit增长",
        ["Telkom Records Revenue of Rp75.9 Trillion in H1 2026"],
        { symbol: "TLKM" },
      ),
    ).toBe("non-latin-script");
  });

  it("rejects a subject naming the issuer when no shipped headline does", () => {
    expect(
      subjectRejection(
        "SOHO Profit Up 111.3% as KAEF Boosts Health Effort",
        [
          "Operating Profit Increased 111.3%, KAEF Accelerates National Health Priority Agenda",
        ],
        { symbol: "SOHO" },
      ),
    ).toBe("issuer-not-in-issue");
  });

  it("accepts a subject naming the issuer when a headline names it too", () => {
    expect(
      subjectRejection(
        "Robert Budi Hartono Becomes Sole BBCA Controller",
        [
          "Robert Budi Hartono Officially Becomes Sole Controller of BCA (BBCA)",
        ],
        { symbol: "BBCA" },
      ),
    ).toBeNull();
  });

  it("accepts a subject about a competitor that never names the issuer", () => {
    expect(
      subjectRejection(
        "Grab raises 2026 forecast on rides growth",
        ["Grab Raises 2026 Forecast as Rides, Driver Numbers Grow"],
        { symbol: "GOTO" },
      ),
    ).toBeNull();
  });
});

describe("resolveSubject", () => {
  it("trims an over-long subject to the budget on a word boundary", () => {
    const result = resolveSubject(
      "Antam Gold Sales Hit 18 Tons as Export Rules Reverse",
      ["Antam Gold Sales Reach 18 Tons in First Half of 2026"],
      { symbol: "ANTM" },
    );

    expect(result.rejection).toBeNull();
    expect(result.subject).toBe("Antam Gold Sales Hit 18 Tons as Export Rules");
    expect(result.subject.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
  });

  it("falls back to a shipped headline when the subject misattributes a competitor's result", () => {
    const titles = [
      "Operating Profit Increased 111.3%, KAEF Accelerates National Health Priority Agenda",
    ];
    const result = resolveSubject(
      "SOHO Profit Up 111.3% as KAEF Boosts Health Effort",
      titles,
      { symbol: "SOHO" },
    );

    expect(result.rejection).toBe("issuer-not-in-issue");
    expect(result.subject).toBe("Operating Profit Increased 111.3%, KAEF");
    expect(result.subject).not.toContain("SOHO");
  });

  it("falls back when the subject carries non-Latin script", () => {
    const result = resolveSubject(
      "Telkom's H1 Revenue Rp75.9T with 6.2% Profit增长",
      ["Telkom Records Revenue of Rp75.9 Trillion in H1 2026"],
      { symbol: "TLKM" },
    );

    expect(result.rejection).toBe("non-latin-script");
    expect(result.subject).toBe(
      "Telkom Records Revenue of Rp75.9 Trillion in H1",
    );
  });

  it("returns the generic subject when the issue has no usable headline", () => {
    const result = resolveSubject("安全生产月", ["四半期決算"], {
      symbol: "TLKM",
    });

    expect(result.rejection).toBe("non-latin-script");
    expect(result.subject).toBe(SUBJECT_FALLBACK_TEXT);
  });
});

describe("WRITE_SUBJECT_SYSTEM_PROMPT", () => {
  it("ranks the issuer's own news above a competitor's", () => {
    expect(WRITE_SUBJECT_SYSTEM_PROMPT).toContain(
      "the issuer's own results or actions",
    );
    expect(WRITE_SUBJECT_SYSTEM_PROMPT).toContain(
      "a company in a different line of business from the issuer must never lead",
    );
  });

  it("requires naming a tension rather than hedging to a neutral verb", () => {
    expect(WRITE_SUBJECT_SYSTEM_PROMPT).toContain("name the specific tension");
  });
});
