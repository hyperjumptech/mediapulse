/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getPipelineWithStepsMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelineWithSteps: (...args: unknown[]) =>
    getPipelineWithStepsMock(...args),
}));

import { getPipelineForEdit } from "./get-for-edit";

describe("getPipelineForEdit", () => {
  afterEach(() => {
    requireDashboardAdminMock.mockReset();
    getPipelineWithStepsMock.mockReset();
  });

  it("rejects callers who are not active admins", async () => {
    // Setup
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = getPipelineForEdit("pipeline-1");

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(getPipelineWithStepsMock).not.toHaveBeenCalled();
  });

  it("returns the edit fields for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    getPipelineWithStepsMock.mockResolvedValue({
      id: "pipeline-1",
      name: "Daily",
      description: null,
      isActive: true,
      timeout: null,
      domainIntegrationId: "integration-1",
      steps: [],
    });

    // Act
    const result = await getPipelineForEdit("pipeline-1");

    // Assert
    expect(result).toEqual({
      id: "pipeline-1",
      name: "Daily",
      description: null,
      isActive: true,
      timeout: null,
      domainIntegrationId: "integration-1",
    });
  });
});
