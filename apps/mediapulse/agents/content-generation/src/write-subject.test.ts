import { describe, expect, it } from "vitest";

import {
  buildSubjectFallback,
  MAX_SUBJECT_LENGTH,
  SUBJECT_FALLBACK_TEXT,
  truncateOnWordBoundary,
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
