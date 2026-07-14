import { describe, expect, it } from "vitest";

import type { SourceForGeneration } from "../types.js";
import { selectSourcesPerSection } from "./select-sources-per-section.js";

const source = (url: string, section: string | null): SourceForGeneration => ({
  url,
  title: `title-${url}`,
  content: "content",
  section,
});

describe("selectSourcesPerSection", () => {
  it("guarantees each section's top article before any section's second", () => {
    const sources = [
      source("a1", "disruptorsOrTech"),
      source("a2", "disruptorsOrTech"),
      source("a3", "disruptorsOrTech"),
      source("b1", "regulatoryPolicyWatch"),
    ];

    const selected = selectSourcesPerSection(sources, 8, 3);

    expect(selected.map((s) => s.url)).toEqual(["a1", "b1", "a2"]);
  });

  it("caps a dense section in the fairness pass when total slots are scarce", () => {
    const sources = [
      source("a1", "quickHits"),
      source("a2", "quickHits"),
      source("a3", "quickHits"),
      source("b1", "competitiveLandscape"),
    ];

    const selected = selectSourcesPerSection(sources, 2, 3);

    expect(selected.map((s) => s.url)).toEqual(["a1", "b1", "a2"]);
  });

  it("fills remaining slots from a dense section when others are sparse", () => {
    const sources = [
      source("a1", "quickHits"),
      source("a2", "quickHits"),
      source("a3", "quickHits"),
      source("b1", "competitiveLandscape"),
    ];

    const selected = selectSourcesPerSection(sources, 2, 10);

    expect(selected.map((s) => s.url).sort()).toEqual(["a1", "a2", "a3", "b1"]);
  });

  it("honors the overall total cap", () => {
    const sources = [
      source("a1", "quickHits"),
      source("b1", "competitiveLandscape"),
      source("c1", "dealsAndMovements"),
    ];

    const selected = selectSourcesPerSection(sources, 8, 2);

    expect(selected).toHaveLength(2);
  });

  it("groups unsectioned sources into a single bucket", () => {
    const sources = [source("a1", null), source("a2", null)];

    const selected = selectSourcesPerSection(sources, 8, 8);

    expect(selected.map((s) => s.url)).toEqual(["a1", "a2"]);
  });
});
