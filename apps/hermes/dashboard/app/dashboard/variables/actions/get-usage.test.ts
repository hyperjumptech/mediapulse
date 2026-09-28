/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getVariablePipelineUsage } from "./get-usage";

const getDashboardAdminMock = vi.fn();
const getUsageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  getDashboardAdmin: () => getDashboardAdminMock(),
}));

vi.mock("@/lib/pipeline-usage", () => ({
  getPipelinesUsingVariableKey: (...args: unknown[]) => getUsageMock(...args),
}));

describe("getVariablePipelineUsage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getDashboardAdminMock.mockReset();
    getUsageMock.mockReset();
  });

  it("returns empty usage when the caller is not an active admin", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue(null);

    // Act
    const result = await getVariablePipelineUsage("API_KEY");

    // Assert
    expect(result).toEqual([]);
    expect(getUsageMock).not.toHaveBeenCalled();
  });

  it("returns pipeline usage for active admins", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue({
      id: "user-1",
      name: "A",
      email: "a@example.com",
      credentialVersion: 0,
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
