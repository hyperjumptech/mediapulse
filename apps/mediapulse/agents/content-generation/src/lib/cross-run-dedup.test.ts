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

describe("dedupeSourcesAgainstRecentBullets: figure overlap", () => {
  const makeSource = (
    dataSourceId: string,
    title: string,
    content: string,
    section: string,
  ): SourceForGeneration => ({
    dataSourceId,
    url: `https://example.com/${dataSourceId}`,
    title,
    content,
    section,
  });

  it("drops the same story rewritten by a second outlet", () => {
    const recentBullets = [
      {
        sectionKey: "competitiveLandscape",
        bulletText:
          "Telkom Akses added 366,000 new ports and deployed 20,223 km of fiber optic in 1H 2026",
      },
    ];
    const sources = [
      makeSource(
        "ds-a",
        "Consistent Transformation, Telkom Akses Records Positive Operational Performance",
        "Sepanjang semester I 2026 perseroan membangun 366.000 port baru serta menggelar 20.223 km kabel serat optik.",
        "competitiveLandscape",
      ),
      makeSource(
        "ds-b",
        "XLSmart wins four Ookla awards",
        "XL Ultra 5G recorded a download speed of 135,4 Mbps across 50 cities.",
        "competitiveLandscape",
      ),
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recentBullets);

    expect(result.removedCount).toBe(1);
    expect(result.sources.map((source) => source.dataSourceId)).toEqual([
      "ds-b",
    ]);
  });

  it("rescues a section whose only candidate repeats the same figures", () => {
    const recentBullets = [
      {
        sectionKey: "dealsAndMovements",
        bulletText:
          "Bank Raya digital savings grew 66,4% yoy to Rp 2,47 triliun at the Raya Preloved Bazaar",
      },
    ];
    const sources = [
      makeSource(
        "ds-bazaar",
        "Bank Raya Holds This Event to Support Creating a Circular Economy",
        "Tabungan digital Bank Raya tumbuh 66,4% yoy menjadi Rp 2,47 triliun lewat Raya Preloved Bazaar Vol. 2.",
        "dealsAndMovements",
      ),
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recentBullets);

    expect(result.sources.map((source) => source.dataSourceId)).toEqual([
      "ds-bazaar",
    ]);
    expect(result.removedCount).toBe(0);
    expect(result.bySection.dealsAndMovements).toBeUndefined();
  });

  it("keeps one issuer-performance source when every candidate repeats yesterday's figures", () => {
    const recentBullets = [
      {
        sectionKey: "issuerPerformance",
        bulletText:
          "BCA Syariah gold financing soared 127% to Rp 1,72 triliun in the first half of 2026",
      },
    ];
    const sources = [
      makeSource(
        "ds-npf",
        "NPF BCA Syariah Naik Tipis Jadi 1,84%",
        "Pembiayaan bermasalah BCA Syariah naik menjadi 1,84% dengan pembiayaan emas 127% menjadi Rp 1,72 triliun pada semester I 2026.",
        "issuerPerformance",
      ),
      makeSource(
        "ds-kpr",
        "Pembiayaan KPR BCA Syariah Tumbuh 26,1%",
        "KPR BCA Syariah tumbuh 26,1% menjadi Rp 1,72 triliun pada semester I 2026, seiring pembiayaan emas yang melonjak 127%.",
        "issuerPerformance",
      ),
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recentBullets);

    expect(result.sources).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });

  it("keeps an unrelated story that happens to share a single figure", () => {
    const recentBullets = [
      {
        sectionKey: "quickHits",
        bulletText: "Coal prices fell 3,21% last week",
      },
    ];
    const sources = [
      makeSource(
        "ds-c",
        "Antam gold sales reach 18 tons",
        "Penjualan emas naik 3,21% sepanjang semester I 2026 menjadi 18.080 kilogram.",
        "quickHits",
      ),
    ];

    const result = dedupeSourcesAgainstRecentBullets(sources, recentBullets);

    expect(result.removedCount).toBe(0);
  });
});
