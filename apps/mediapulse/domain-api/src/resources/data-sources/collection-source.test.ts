/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildCollectionSourceDataSourceWhere,
  classifyCollectionSource,
  COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL,
  COLLECTION_SOURCE_LABEL,
  COLLECTION_SOURCE_OPTIONS,
} from "./collection-source";

describe("classifyCollectionSource", () => {
  it("maps a data source with a search query to data-collection", () => {
    expect(classifyCollectionSource(true)).toBe("data-collection");
  });

  it("maps a data source without a search query to page-collection", () => {
    expect(classifyCollectionSource(false)).toBe("page-collection");
  });
});

describe("COLLECTION_SOURCE_LABEL", () => {
  it("labels page-collection as Page Collection", () => {
    expect(COLLECTION_SOURCE_LABEL["page-collection"]).toBe("Page Collection");
  });

  it("labels data-collection as Data Collection", () => {
    expect(COLLECTION_SOURCE_LABEL["data-collection"]).toBe("Data Collection");
  });
});

describe("COLLECTION_SOURCE_OPTIONS", () => {
  it("exposes page-collection and data-collection labels for meta", () => {
    expect(COLLECTION_SOURCE_OPTIONS).toEqual([
      { value: "page-collection", label: "Page Collection" },
      { value: "data-collection", label: "Data Collection" },
    ]);
  });
});

describe("buildCollectionSourceDataSourceWhere", () => {
  it("maps page-collection to data sources without a search query", () => {
    expect(buildCollectionSourceDataSourceWhere("page-collection")).toEqual({
      searchQueryId: null,
    });
  });

  it("maps data-collection to data sources with a search query", () => {
    expect(buildCollectionSourceDataSourceWhere("data-collection")).toEqual({
      searchQueryId: { not: null },
    });
  });
});

describe("COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL", () => {
  it("assigns success variant to Page Collection", () => {
    expect(COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL["Page Collection"]).toBe(
      "success",
    );
  });

  it("assigns outline variant to Data Collection", () => {
    expect(COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL["Data Collection"]).toBe(
      "outline",
    );
  });
});
