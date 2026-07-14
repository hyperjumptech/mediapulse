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
