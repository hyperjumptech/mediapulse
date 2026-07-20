import { describe, expect, it } from "vitest";

import type { SourceForGeneration } from "../types.js";
import {
  dedupeSourcesAgainstRecentBullets,
  type RecentBullet,
} from "./cross-run-dedup.js";

const REPEATED_TEXT =
  "Rival launches new premium coffee subscription service nationwide next quarter";
const NOVEL_TEXT =
  "Regulator approves updated banking capital adequacy framework guidance today";

const source = (
  title: string,
  content: string,
  section: string,
): SourceForGeneration => ({
  dataSourceId: `ds-${title}`,
  url: `https://source.example/${encodeURIComponent(title)}`,
  title,
  content,
  section,
});

describe("dedupeSourcesAgainstRecentBullets", () => {
  it("is a no-op when the recent corpus is empty", () => {
    const sources = [source("Rival", REPEATED_TEXT, "competitiveLandscape")];

    const result = dedupeSourcesAgainstRecentBullets(sources, []);

    expect(result.removedCount).toBe(0);
    expect(result.sources).toEqual(sources);
  });

  it("drops a source that repeats a recent bullet and keeps a novel one", () => {
    const sources = [
      source("Rival", REPEATED_TEXT, "competitiveLandscape"),
      source("Regulator", NOVEL_TEXT, "competitiveLandscape"),
    ];
    const recent: RecentBullet[] = [
      { sectionKey: "competitiveLandscape", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recent);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.title).toBe("Regulator");
    expect(result.removedCount).toBe(1);
    expect(result.bySection["competitiveLandscape"]).toBe(1);
  });

  it("never empties a section: rescues the most novel source when every source repeats", () => {
    const sources = [
      source("Rival", REPEATED_TEXT, "dealsAndMovements"),
      source("Regulator", NOVEL_TEXT, "dealsAndMovements"),
    ];
    const recent: RecentBullet[] = [
      { sectionKey: "dealsAndMovements", bulletText: REPEATED_TEXT },
      { sectionKey: "dealsAndMovements", bulletText: NOVEL_TEXT },
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recent);

    expect(result.sources).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.bySection["dealsAndMovements"]).toBe(1);
  });

  it("applies the floor per section rather than across the whole run", () => {
    const sources = [
      source("Rival", REPEATED_TEXT, "competitiveLandscape"),
      source("Regulator", NOVEL_TEXT, "regulatoryPolicyWatch"),
    ];
    const recent: RecentBullet[] = [
      { sectionKey: "competitiveLandscape", bulletText: REPEATED_TEXT },
      { sectionKey: "regulatoryPolicyWatch", bulletText: NOVEL_TEXT },
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recent);

    expect(result.sources).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it("groups unassigned sources under a single bucket", () => {
    const unassigned: SourceForGeneration = {
      url: "https://source.example/unassigned",
      title: "Loose story",
      content: REPEATED_TEXT,
    };
    const sources = [
      source("Rival", REPEATED_TEXT, "quickHits"),
      unassigned,
      { ...unassigned, url: "https://source.example/unassigned-2" },
    ];
    const recent: RecentBullet[] = [
      { sectionKey: "quickHits", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recent);

    expect(result.removedCount).toBe(1);
    expect(result.bySection["unassigned"]).toBe(1);
    expect(result.bySection["quickHits"]).toBeUndefined();
  });
});
