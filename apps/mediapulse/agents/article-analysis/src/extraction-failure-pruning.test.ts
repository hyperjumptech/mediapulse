/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  hardDeleteDataSourceById,
  shouldHardDeleteDataSourceForNonArticleReason,
  shouldHardDeleteDataSourceForExtractionError,
} from "./extraction-failure-pruning.js";

describe("shouldHardDeleteDataSourceForExtractionError", () => {
  it("returns true for parse-response extraction failures", () => {
    // Act
    const result = shouldHardDeleteDataSourceForExtractionError(
      "No object generated: could not parse the response.",
    );

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for other extraction failures", () => {
    // Act
    const result = shouldHardDeleteDataSourceForExtractionError(
      "No object generated: the model did not return a response.",
    );

    // Assert
    expect(result).toBe(false);
  });
});

describe("hardDeleteDataSourceById", () => {
  it("calls agent-data-api prune endpoint with ticker and source id", async () => {
    // Setup
    const dataApiClient = {
      analysisDataSourceDelete: {
        create: vi.fn().mockResolvedValue({ deleted: true }),
      },
    };

    // Act
    await hardDeleteDataSourceById("ds-1", {
      dataApiClient: dataApiClient as Parameters<
        typeof hardDeleteDataSourceById
      >[1]["dataApiClient"],
      tickerId: "ticker-1",
    });

    // Assert
    expect(dataApiClient.analysisDataSourceDelete.create).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      dataSourceId: "ds-1",
    });
  });
});

describe("shouldHardDeleteDataSourceForNonArticleReason", () => {
  it("returns true for deterministic URL-based non-article reasons", () => {
    // Act
    const blockedHost = shouldHardDeleteDataSourceForNonArticleReason(
      "prefilter_blocked_host",
    );
    const blockedPath = shouldHardDeleteDataSourceForNonArticleReason(
      "prefilter_blocked_path",
    );

    // Assert
    expect(blockedHost).toBe(true);
    expect(blockedPath).toBe(true);
  });

  it("returns false for title-only heuristic reasons", () => {
    // Act
    const result = shouldHardDeleteDataSourceForNonArticleReason(
      "prefilter_index_title",
    );

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for soft-404 content drops", () => {
    // Act
    const result =
      shouldHardDeleteDataSourceForNonArticleReason("content_soft_404");

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for recoverable content quality drops", () => {
    // Act
    const paywall = shouldHardDeleteDataSourceForNonArticleReason(
      "content_access_gated",
    );
    const tooShort =
      shouldHardDeleteDataSourceForNonArticleReason("content_too_short");

    // Assert
    expect(paywall).toBe(false);
    expect(tooShort).toBe(false);
  });
});
