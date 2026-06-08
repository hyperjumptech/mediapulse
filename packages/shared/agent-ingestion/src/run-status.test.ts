/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { deriveRunStatus } from "./run-status";

describe("deriveRunStatus", () => {
  it("returns failed when zero successes violate failOnZeroSuccess policy", () => {
    // Act
    const status = deriveRunStatus({
      totalSources: 0,
      failureCount: 0,
      runPolicy: {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      },
    });

    // Assert
    expect(status).toBe("failed");
  });

  it("returns success when failures are zero and policy is satisfied", () => {
    // Act
    const status = deriveRunStatus({
      totalSources: 2,
      failureCount: 0,
      runPolicy: {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      },
    });

    // Assert
    expect(status).toBe("success");
  });

  it("returns partial_success when there are failures but policy is not failed", () => {
    // Act
    const status = deriveRunStatus({
      totalSources: 1,
      failureCount: 1,
      runPolicy: {
        minSuccessfulSources: 0,
        failOnZeroSuccess: false,
      },
    });

    // Assert
    expect(status).toBe("partial_success");
  });

  it("returns failed when successes are below minSuccessfulSources", () => {
    // Act
    const status = deriveRunStatus({
      totalSources: 0,
      failureCount: 3,
      runPolicy: {
        minSuccessfulSources: 2,
        failOnZeroSuccess: true,
      },
    });

    // Assert
    expect(status).toBe("failed");
  });
});
