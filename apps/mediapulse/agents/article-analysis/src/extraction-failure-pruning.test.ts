/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  hardDeleteDataSourceById,
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
