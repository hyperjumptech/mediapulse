/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  evidenceLabel,
  evidenceVariant,
  formatObservedWindow,
  kindLabel,
  lockedLabel,
  lockedVariant,
  parseAttachEvidence,
  tickerSourceLabel,
  truncateTitle,
} from "./storyline-labels";

const evidence = {
  sharedAnchors: 6,
  containment: 0.71,
  storylineContainment: 0.62,
  path: "body",
};

describe("kindLabel", () => {
  it("labels both storyline kinds", () => {
    expect(kindLabel("story")).toBe("Story");
    expect(kindLabel("format")).toBe("Format");
  });
});

describe("lockedLabel and lockedVariant", () => {
  it("reads a locked storyline as a warning", () => {
    expect(lockedLabel(true)).toBe("Locked");
    expect(lockedVariant(true)).toBe("warning");
  });

  it("reads an open storyline as a success", () => {
    expect(lockedLabel(false)).toBe("Open");
    expect(lockedVariant(false)).toBe("success");
  });
});

describe("tickerSourceLabel", () => {
  it("distinguishes operator links from placement links", () => {
    expect(tickerSourceLabel("operator")).toBe("Operator");
    expect(tickerSourceLabel("placement")).toBe("Placement");
  });
});

describe("truncateTitle", () => {
  it("leaves a short title untouched", () => {
    expect(truncateTitle("Contract delay")).toBe("Contract delay");
  });

  it("collapses whitespace", () => {
    expect(truncateTitle("Contract    delay")).toBe("Contract delay");
  });

  it("ellipsizes a long title at the cap", () => {
    const truncated = truncateTitle("a".repeat(120));

    expect(truncated).toHaveLength(80);
    expect(truncated.endsWith("…")).toBe(true);
  });
});

describe("parseAttachEvidence", () => {
  it("parses well-formed stored evidence", () => {
    expect(parseAttachEvidence(evidence)?.sharedAnchors).toBe(6);
  });

  it("returns null for null, junk, and a wrong-shaped object", () => {
    expect(parseAttachEvidence(null)).toBeNull();
    expect(parseAttachEvidence("nonsense")).toBeNull();
    expect(parseAttachEvidence({ sharedAnchors: "six" })).toBeNull();
  });

  it("rejects an unknown match path", () => {
    expect(parseAttachEvidence({ ...evidence, path: "headline" })).toBeNull();
  });
});

describe("evidenceLabel", () => {
  it("summarizes a body-path attach", () => {
    expect(evidenceLabel(evidence)).toBe(
      "Body path · 6 shared anchors · containment 0.71 · thread 0.62",
    );
  });

  it("summarizes a title-path attach", () => {
    expect(evidenceLabel({ ...evidence, path: "title" })).toContain(
      "Title path",
    );
  });

  it("singularizes a lone shared anchor", () => {
    expect(evidenceLabel({ ...evidence, sharedAnchors: 1 })).toContain(
      "1 shared anchor ·",
    );
  });

  it("reads null evidence as the storyline opener", () => {
    expect(evidenceLabel(null)).toBe("Opened this storyline");
  });
});

describe("evidenceVariant", () => {
  it("bands containment into badge variants", () => {
    expect(evidenceVariant({ ...evidence, containment: 0.8 })).toBe("success");
    expect(evidenceVariant({ ...evidence, containment: 0.5 })).toBe("warning");
    expect(evidenceVariant({ ...evidence, containment: 0.2 })).toBe("muted");
  });

  it("marks the opener with its own variant", () => {
    expect(evidenceVariant(null)).toBe("outline");
  });
});

describe("formatObservedWindow", () => {
  it("collapses a single-day window to one date", () => {
    const day = new Date("2026-03-02T10:00:00.000Z");

    expect(formatObservedWindow(day, day)).toBe("2026-03-02");
  });

  it("renders a multi-day window as a range", () => {
    expect(
      formatObservedWindow(
        new Date("2026-03-02T10:00:00.000Z"),
        new Date("2026-04-18T10:00:00.000Z"),
      ),
    ).toBe("2026-03-02 – 2026-04-18");
  });
});
