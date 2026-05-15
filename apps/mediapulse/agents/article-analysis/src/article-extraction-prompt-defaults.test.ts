/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  formatArticleAnalysisEntityTypesBlock,
  formatArticleAnalysisRelationTypesBlock,
} from "./article-extraction-prompt-defaults.js";

const TID = "11111111-1111-4111-a111-111111111111";

describe("formatArticleAnalysisEntityTypesBlock", () => {
  it("joins entity type lines", () => {
    // Act
    const block = formatArticleAnalysisEntityTypesBlock({
      entityTypes: [{ id: TID, name: "Co", description: null }],
    });

    // Assert
    expect(block).toBe(`- ${TID} — Co`);
  });
});

describe("formatArticleAnalysisRelationTypesBlock", () => {
  it("joins relation type lines", () => {
    const block = formatArticleAnalysisRelationTypesBlock({
      relationTypes: [{ id: TID, name: "REL", description: null }],
    });

    expect(block).toBe(`- ${TID} — REL`);
  });
});
