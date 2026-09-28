/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getHttpTriggerByIdMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerById: (...args: unknown[]) => getHttpTriggerByIdMock(...args),
}));

import { getHttpTriggerForEdit } from "./get-for-edit";

describe("getHttpTriggerForEdit", () => {
  afterEach(() => {
    requireDashboardAdminMock.mockReset();
    getHttpTriggerByIdMock.mockReset();
  });

  it("rejects callers who are not active admins", async () => {
    // Setup
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = getHttpTriggerForEdit("trigger-1");

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(getHttpTriggerByIdMock).not.toHaveBeenCalled();
  });

  it("returns the edit fields for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    getHttpTriggerByIdMock.mockResolvedValue({
      id: "trigger-1",
      name: "Webhook",
      description: null,
      pipelineId: "pipeline-1",
      enabled: true,
      method: "POST",
      tokenHint: "abcd",
      tokenHash: "hidden",
    });

    // Act
    const result = await getHttpTriggerForEdit("trigger-1");

    // Assert
    expect(result).toEqual({
      id: "trigger-1",
      name: "Webhook",
      description: null,
      pipelineId: "pipeline-1",
      enabled: true,
      method: "POST",
      tokenHint: "abcd",
    });
  });
});
