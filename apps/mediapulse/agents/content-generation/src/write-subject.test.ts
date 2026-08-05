import { describe, expect, it } from "vitest";

import {
  buildSubjectFallback,
  buildSubjectPrompt,
  MAX_SUBJECT_LENGTH,
  SUBJECT_FALLBACK_TEXT,
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
