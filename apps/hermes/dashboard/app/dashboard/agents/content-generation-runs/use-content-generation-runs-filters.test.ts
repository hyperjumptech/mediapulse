import { describe, expect, it } from "vitest";
import { useContentGenerationRunsFilters } from "./use-content-generation-runs-filters";

describe("useContentGenerationRunsFilters", () => {
  it("returns hasActiveFilters=false when no filters are set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({});

    // Assert
    expect(hasActiveFilters).toBe(false);
  });

  it("returns hasActiveFilters=true when outcome is set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      outcome: "failed",
    });

    // Assert
    expect(hasActiveFilters).toBe(true);
  });

  it("returns hasActiveFilters=true when tickerId is set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      tickerId: "abc-123",
    });

    // Assert
    expect(hasActiveFilters).toBe(true);
  });

  it("returns hasActiveFilters=true when startTime is set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      startTime: "2026-04-01",
    });

    // Assert
    expect(hasActiveFilters).toBe(true);
  });

  it("returns hasActiveFilters=true when endTime is set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      endTime: "2026-04-30",
    });

    // Assert
    expect(hasActiveFilters).toBe(true);
  });

  it("returns hasActiveFilters=false when all values are empty strings", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      outcome: "",
      tickerId: "",
      startTime: "",
      endTime: "",
    });

    // Assert
    expect(hasActiveFilters).toBe(false);
  });

  it("returns hasActiveFilters=true when multiple filters are set", () => {
    // Act
    const { hasActiveFilters } = useContentGenerationRunsFilters({
      outcome: "success",
      tickerId: "abc",
      startTime: "2026-01-01",
      endTime: "2026-12-31",
    });

    // Assert
    expect(hasActiveFilters).toBe(true);
  });
});
