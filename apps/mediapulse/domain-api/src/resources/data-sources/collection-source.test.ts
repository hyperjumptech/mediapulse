/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  classifyCollectionSource,
  COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL,
  COLLECTION_SOURCE_LABEL,
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
