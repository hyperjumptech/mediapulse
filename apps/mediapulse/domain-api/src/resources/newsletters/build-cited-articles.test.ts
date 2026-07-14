import { describe, expect, it, vi } from "vitest";

import { buildCitedArticles } from "./build-cited-articles";

const citationRow = (overrides: {
  dataSourceId: string;
  title: string;
  url: string;
  sectionKey: string;
  searchQueryId: string | null;
  queryText?: string;
  classifiedSection?: string | null;
  sectionScore?: number | null;
  sectionReason?: string | null;
}) => ({
  sectionKey: overrides.sectionKey,
  dataSource: {
    id: overrides.dataSourceId,
    url: overrides.url,
    title: overrides.title,
    searchQueryId: overrides.searchQueryId,
    searchQuery: overrides.queryText ? { text: overrides.queryText } : null,
    tickerSections:
      overrides.classifiedSection === undefined
        ? []
        : [
            {
              section: overrides.classifiedSection,
              sectionScore: overrides.sectionScore ?? null,
              sectionReason: overrides.sectionReason ?? null,
            },
          ],
  },
});

describe("buildCitedArticles", () => {
  it("queries newsletter citations scoped to the ticker's section classification", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await buildCitedArticles("nl-1", "tk-1", {
      newsletterCitation: { findMany },
    });

    const args = findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ newsletterId: "nl-1" });
    expect(args?.include?.dataSource?.select?.tickerSections?.where).toEqual({
      tickerId: "tk-1",
    });
  });

  it("orders rows by newsletter section, then score desc, then title", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "q-low",
        title: "Zeta quick hit",
        url: "https://example.com/q-low",
        sectionKey: "quickHits",
        searchQueryId: "sq",
        queryText: "market recap",
        classifiedSection: "quickHits",
        sectionScore: 0.3,
      }),
      citationRow({
        dataSourceId: "deal-b",
        title: "Beta deal",
        url: "https://example.com/deal-b",
        sectionKey: "dealsAndMovements",
        searchQueryId: "sq",
        queryText: "acquisition",
        classifiedSection: "dealsAndMovements",
        sectionScore: 0.6,
      }),
      citationRow({
        dataSourceId: "lead",
        title: "Alpha lead",
        url: "https://example.com/lead",
        sectionKey: "industryPulse",
        searchQueryId: "sq",
        queryText: "sector outlook",
        classifiedSection: "industryPulse",
        sectionScore: 0.9,
      }),
      citationRow({
        dataSourceId: "deal-a",
        title: "Alpha deal",
        url: "https://example.com/deal-a",
        sectionKey: "dealsAndMovements",
        searchQueryId: "sq",
        queryText: "acquisition",
        classifiedSection: "dealsAndMovements",
        sectionScore: 0.6,
      }),
    ]);

    const result = await buildCitedArticles("nl-1", "tk-1", {
      newsletterCitation: { findMany },
    });

    expect(result.map((row) => row.id)).toEqual([
      "lead",
      "deal-a",
      "deal-b",
      "q-low",
    ]);
    expect(result[0]?.publishedSection).toBe("Industry Pulse");
  });

  it("flags a section re-placement and names the original classification", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "moved",
        title: "Re-placed item",
        url: "https://example.com/moved",
        sectionKey: "quickHits",
        searchQueryId: "sq",
        queryText: "policy",
        classifiedSection: "regulatoryPolicyWatch",
        sectionScore: 0.55,
      }),
    ]);

    const [row] = await buildCitedArticles("nl-1", "tk-1", {
      newsletterCitation: { findMany },
    });

    expect(row?.sectionMismatch).toBe(true);
    expect(row?.publishedSection).toBe("Quick Hits");
    expect(row?.classifiedSection).toBe("Regulatory & Policy Watch");
  });

  it("labels curated sources and clears the query link target", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "curated",
        title: "Curated brief",
        url: "https://example.com/curated",
        sectionKey: "industryPulse",
        searchQueryId: null,
        classifiedSection: "industryPulse",
        sectionScore: 0.8,
      }),
    ]);

    const [row] = await buildCitedArticles("nl-1", "tk-1", {
      newsletterCitation: { findMany },
    });

    expect(row?.collectionSource).toBe("page-collection");
    expect(row?.queryText).toBe("Curated source");
    expect(row?.queryLinkTickerId).toBe("");
  });

  it("keeps sectionMismatch false when no article-analysis classification exists", async () => {
    const findMany = vi.fn().mockResolvedValue([
      citationRow({
        dataSourceId: "unscored",
        title: "Unscored item",
        url: "https://example.com/unscored",
        sectionKey: "quickHits",
        searchQueryId: "sq",
        queryText: "misc",
      }),
    ]);

    const [row] = await buildCitedArticles("nl-1", "tk-1", {
      newsletterCitation: { findMany },
    });

    expect(row?.sectionMismatch).toBe(false);
    expect(row?.classifiedSection).toBe("");
    expect(row?.sectionScore).toBeNull();
    expect(row?.queryLinkTickerId).toBe("tk-1");
  });
});
