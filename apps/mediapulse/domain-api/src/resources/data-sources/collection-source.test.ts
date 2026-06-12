/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildCollectionSourceSearchQueryWhere,
  classifyCollectionSource,
  COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL,
  COLLECTION_SOURCE_LABEL,
  COLLECTION_SOURCE_OPTIONS,
} from "./collection-source";

describe("classifyCollectionSource", () => {
  it("maps curated to page-collection", () => {
    expect(classifyCollectionSource("curated")).toBe("page-collection");
  });

  it("maps deterministic to data-collection", () => {
    expect(classifyCollectionSource("deterministic")).toBe("data-collection");
  });

  it("maps llm to data-collection", () => {
    expect(classifyCollectionSource("llm")).toBe("data-collection");
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

describe("buildCollectionSourceSearchQueryWhere", () => {
  it("maps page-collection to curated search queries", () => {
    expect(buildCollectionSourceSearchQueryWhere("page-collection")).toEqual({
      source: "curated",
    });
  });

  it("maps data-collection to deterministic and llm search queries", () => {
    expect(buildCollectionSourceSearchQueryWhere("data-collection")).toEqual({
      source: { in: ["deterministic", "llm"] },
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
