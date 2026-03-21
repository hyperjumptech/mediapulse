import { describe, it, expect } from "vitest";

import {
  getPipelineStatus,
  getPipelineStatusMap,
  type PipelineValidationResult,
} from "./pipeline-status";

describe("getPipelineStatus", () => {
  it("returns incomplete when validation is invalid", () => {
    // Act
    const status = getPipelineStatus(
      { id: "p1", isActive: true },
      { valid: false, warnings: ["Step 1: missing input"] },
    );
    // Assert
    expect(status).toBe("incomplete");
  });

  it("returns incomplete when validation invalid even if pipeline inactive", () => {
    // Act
    const status = getPipelineStatus(
      { id: "p1", isActive: false },
      { valid: false, warnings: [] },
    );
    // Assert
    expect(status).toBe("incomplete");
  });

  it("returns disabled when validation valid but isActive false", () => {
    // Act
    const status = getPipelineStatus(
      { id: "p1", isActive: false },
      { valid: true, warnings: [] },
    );
    // Assert
    expect(status).toBe("disabled");
  });

  it("returns enabled when validation valid and isActive true", () => {
    // Act
    const status = getPipelineStatus(
      { id: "p1", isActive: true },
      { valid: true, warnings: [] },
    );
    // Assert
    expect(status).toBe("enabled");
  });
});

describe("getPipelineStatusMap", () => {
  it("returns status per pipeline id", () => {
    // Setup
    const pipelines = [
      { id: "a", isActive: true },
      { id: "b", isActive: false },
      { id: "c", isActive: true },
    ];
    const validationById: Record<string, PipelineValidationResult> = {
      a: { valid: true, warnings: [] },
      b: { valid: true, warnings: [] },
      c: { valid: false, warnings: ["x"] },
    };
    // Act
    const map = getPipelineStatusMap(pipelines, validationById);
    // Assert
    expect(map.a).toBe("enabled");
    expect(map.b).toBe("disabled");
    expect(map.c).toBe("incomplete");
  });

  it("treats missing validation as invalid (incomplete)", () => {
    // Setup
    const pipelines = [{ id: "p1", isActive: true }];
    const validationById: Record<string, PipelineValidationResult> = {};
    // Act
    const map = getPipelineStatusMap(pipelines, validationById);
    // Assert
    expect(map.p1).toBe("incomplete");
  });
});
