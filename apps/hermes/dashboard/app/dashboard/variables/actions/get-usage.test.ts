/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getVariablePipelineUsage } from "./get-usage";

const getSessionMock = vi.fn();
const getUsageMock = vi.fn();

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("@/lib/pipeline-usage", () => ({
  getPipelinesUsingVariableKey: (...args: unknown[]) => getUsageMock(...args),
}));

describe("getVariablePipelineUsage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getUsageMock.mockReset();
  });

  it("returns empty usage when user is not authenticated", async () => {
    // Setup
    getSessionMock.mockResolvedValue(null);

    // Act
    const result = await getVariablePipelineUsage("API_KEY");

    // Assert
    expect(result).toEqual([]);
    expect(getUsageMock).not.toHaveBeenCalled();
  });

  it("returns pipeline usage for authenticated users", async () => {
    // Setup
    getSessionMock.mockResolvedValue({
      id: "user-1",
      name: "A",
      email: "a@example.com",
    });
    getUsageMock.mockResolvedValue([
      {
        id: "pipeline-1",
        name: "Pipeline one",
        matchCount: 1,
        matchedStepIds: ["step-1"],
      },
    ]);

    // Act
    const result = await getVariablePipelineUsage("API_KEY");

    // Assert
    expect(getUsageMock).toHaveBeenCalledWith("API_KEY");
    expect(result).toEqual([
      {
        id: "pipeline-1",
        name: "Pipeline one",
        matchCount: 1,
        matchedStepIds: ["step-1"],
      },
    ]);
  });
});
