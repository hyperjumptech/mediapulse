import { describe, expect, it } from "vitest";
import {
  MAX_PREVIEW_EXPANSION_ERROR_LEN,
  truncatePreviewExpansionError,
} from "./preview-expansion-error";

describe("truncatePreviewExpansionError", () => {
  it("returns trimmed text when under the max length", () => {
    // Act
    const result = truncatePreviewExpansionError("  ok  ");

    // Assert
    expect(result).toBe("ok");
  });

  it("truncates with an ellipsis suffix when over the max length", () => {
    // Setup
    const long = "x".repeat(MAX_PREVIEW_EXPANSION_ERROR_LEN + 50);

    // Act
    const result = truncatePreviewExpansionError(long);

    // Assert
    expect(result).toHaveLength(MAX_PREVIEW_EXPANSION_ERROR_LEN + 1);
    expect(result.endsWith("…")).toBe(true);
  });
});
