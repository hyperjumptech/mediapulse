import { describe, expect, it } from "vitest";

import {
  anchorsFor,
  decideAttachment,
  lockReasonFor,
  type StorylineSnapshot,
} from "./attach.js";

const TELKOM_ANNOUNCEMENT = {
  dataSourceId: "ds-1",
  title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
  text: "Telkom Indonesia memangkas jumlah anak usaha dari 67 menjadi 19 entitas sebagai bagian transformasi menuju strategic holding.",
};

const TELKOM_SECOND_OUTLET = {
  dataSourceId: "ds-2",
  title: "Telkom Pangkas Anak Usaha Jadi 19 Entitas",
  text: "Telkom Indonesia memangkas anak usaha dari 67 menjadi 19 entitas dalam transformasi menuju strategic holding.",
};

const TELKOM_NEXT_MOVE = {
  dataSourceId: "ds-3",
  title: "Telkom Tuntaskan Streamlining 10 Anak Usaha Entitas",
  text: "Telkom Indonesia menuntaskan streamlining 10 anak usaha entitas senilai Rp2,4 triliun dalam transformasi strategic holding.",
};

const UNRELATED = {
  dataSourceId: "ds-4",
  title: "Harga Pangan Hari Ini: Cabai Rawit Merah Turun",
  text: "Harga cabai rawit merah tercatat Rp61.900 per kilogram, sementara telur ayam stabil.",
};

const storylineFrom = (
  articles: readonly { title: string; text: string }[],
  overrides: Partial<StorylineSnapshot> = {},
): StorylineSnapshot => {
  const developments = articles.map((article, index) => {
    const anchors = anchorsFor({ dataSourceId: `seed-${index}`, ...article });

    return {
      id: `dev-${index}`,
      anchors: anchors.anchors,
      titleAnchors: anchors.titleAnchors,
      figures: anchors.figures,
      day: "2026-06-29",
    };
  });
  const union = new Set<string>();
  for (const development of developments) {
    for (const anchor of development.anchors) {
      union.add(anchor);
    }
  }

  return {
    id: "story-1",
    anchors: union,
    tickerCount: 1,
    locked: false,
    developments,
    ...overrides,
  };
};

describe("decideAttachment", () => {
  it("skips an article with no distinctive anchors", () => {
    const candidate = anchorsFor({
      dataSourceId: "ds-0",
      title: "PT",
      text: "",
    });
    const decision = decideAttachment(candidate, undefined, []);

    expect(decision).toEqual({ kind: "skip", reason: "no-anchors" });
  });

  it("opens a storyline when nothing matches", () => {
    const candidate = anchorsFor(TELKOM_ANNOUNCEMENT);
    const decision = decideAttachment(candidate, undefined, []);

    expect(decision.kind).toBe("openStoryline");
  });

  it("cites the existing development when a second outlet reports the same move", () => {
    const storyline = storylineFrom([TELKOM_ANNOUNCEMENT]);
    const candidate = anchorsFor(TELKOM_SECOND_OUTLET);
    const decision = decideAttachment(candidate, "2026-06-29", [storyline]);

    expect(decision.kind).toBe("cite");
    expect(decision).toMatchObject({
      storylineId: "story-1",
      developmentId: "dev-0",
    });
  });

  it("opens a development when the thread moves again with a new figure", () => {
    const storyline = storylineFrom([TELKOM_ANNOUNCEMENT]);
    const candidate = anchorsFor(TELKOM_NEXT_MOVE);
    const decision = decideAttachment(candidate, "2026-07-06", [storyline]);

    expect(decision.kind).toBe("openDevelopment");
    expect(decision).toMatchObject({ storylineId: "story-1" });
  });

  it("records the evidence behind an attachment", () => {
    const storyline = storylineFrom([TELKOM_ANNOUNCEMENT]);
    const candidate = anchorsFor(TELKOM_SECOND_OUTLET);
    const decision = decideAttachment(candidate, "2026-06-29", [storyline]);

    expect(decision).toHaveProperty("evidence");
    if (decision.kind === "cite") {
      expect(decision.evidence.sharedAnchors).toBeGreaterThanOrEqual(4);
      expect(decision.evidence.containment).toBeGreaterThanOrEqual(0.4);
      expect(decision.evidence.path).toBe("body");
    }
  });

  it("refuses an unrelated article rather than chaining it onto the thread", () => {
    const storyline = storylineFrom([TELKOM_ANNOUNCEMENT, TELKOM_NEXT_MOVE]);
    const candidate = anchorsFor(UNRELATED);
    const decision = decideAttachment(candidate, "2026-07-13", [storyline]);

    expect(decision.kind).toBe("openStoryline");
  });

  it("treats a locked storyline as absent so a suspected bad merge cannot grow", () => {
    const storyline = storylineFrom([TELKOM_ANNOUNCEMENT], { locked: true });
    const candidate = anchorsFor(TELKOM_SECOND_OUTLET);
    const decision = decideAttachment(candidate, "2026-06-29", [storyline]);

    expect(decision.kind).toBe("openStoryline");
  });
});

describe("lockReasonFor", () => {
  it("leaves a thread open while it is within both ceilings", () => {
    expect(lockReasonFor(3, 12)).toBeNull();
  });

  it("locks a thread that spreads past the ticker ceiling", () => {
    expect(lockReasonFor(9, 4)).toContain("9 tickers");
  });

  it("locks a thread that grows past the development ceiling", () => {
    expect(lockReasonFor(2, 608)).toContain("608 developments");
  });
});
