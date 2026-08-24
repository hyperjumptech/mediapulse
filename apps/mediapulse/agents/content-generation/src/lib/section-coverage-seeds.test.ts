import { describe, expect, it } from "vitest";

import {
  selectSectionCoverageSeeds,
  type SectionCoverageSeedSource,
} from "./section-coverage-seeds";

const source = (
  overrides: Partial<SectionCoverageSeedSource> &
    Pick<
      SectionCoverageSeedSource,
      "dataSourceId" | "section" | "sectionScore"
    >,
): SectionCoverageSeedSource => ({
  url: `https://example.com/${overrides.dataSourceId}`,
  title: `title-${overrides.dataSourceId}`,
  content: null,
  ...overrides,
});

const SECTIONS = [
  "industryPulse",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
];

describe("selectSectionCoverageSeeds", () => {
  it("breaks a score tie toward the description that asserts a figure", () => {
    const sources = [
      source({
        dataSourceId: "unrelated",
        title: "Keuangan Syariah Makin Diminati di Jatim",
        section: "issuerPerformance",
        sectionScore: 0.75,
        content: null,
        description: "Pembiayaan syariah tumbuh di Jawa Timur.",
      }),
      source({
        dataSourceId: "dividend",
        title: "BCA Tebar Dividen Interim, Nilainya Segini",
        section: "issuerPerformance",
        sectionScore: 0.75,
        content: null,
        description:
          "BCA membagikan dividen interim Rp3,07 triliun, setara Rp25 per saham.",
      }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, ["issuerPerformance"]);

    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.dataSourceId).toBe("dividend");
  });

  it("still prefers the higher score over a figure-bearing description", () => {
    const sources = [
      source({
        dataSourceId: "figure-low",
        title: "Low fit but cites a figure",
        section: "issuerPerformance",
        sectionScore: 0.5,
        content: null,
        description: "Laba naik Rp2,73 triliun.",
      }),
      source({
        dataSourceId: "high",
        title: "High fit no figure",
        section: "issuerPerformance",
        sectionScore: 0.9,
        content: null,
        description: "Perseroan mengumumkan hasil kuartalan.",
      }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, ["issuerPerformance"]);

    expect(seeds[0]?.dataSourceId).toBe("high");
  });

  it("returns the highest-scored un-fetched source per section", () => {
    const sources = [
      source({
        dataSourceId: "a",
        section: "dealsAndMovements",
        sectionScore: 0.6,
      }),
      source({
        dataSourceId: "b",
        section: "dealsAndMovements",
        sectionScore: 0.8,
      }),
      source({
        dataSourceId: "c",
        section: "regulatoryPolicyWatch",
        sectionScore: 1,
      }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, SECTIONS);

    expect(seeds.map((seed) => seed.dataSourceId)).toEqual(["b", "c"]);
    expect(seeds[0]?.reason).toBe("section-coverage: top dealsAndMovements");
  });

  it("skips sources that already carry a body", () => {
    const sources = [
      source({
        dataSourceId: "fetched",
        section: "dealsAndMovements",
        sectionScore: 0.9,
        content: "full article body already present",
      }),
      source({
        dataSourceId: "thin",
        section: "dealsAndMovements",
        sectionScore: 0.5,
      }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, SECTIONS);

    expect(seeds.map((seed) => seed.dataSourceId)).toEqual(["thin"]);
  });

  it("emits no seed for a section with no candidates", () => {
    const sources = [
      source({ dataSourceId: "a", section: "quickHits", sectionScore: 0.7 }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, SECTIONS);

    expect(seeds).toEqual([]);
  });

  it("dedupes a source that tops two requested sections", () => {
    const sources = [
      source({
        dataSourceId: "shared",
        section: "industryPulse",
        sectionScore: 0.9,
      }),
    ];

    const seeds = selectSectionCoverageSeeds(sources, [
      "industryPulse",
      "industryPulse",
    ]);

    expect(seeds).toHaveLength(1);
  });
});
