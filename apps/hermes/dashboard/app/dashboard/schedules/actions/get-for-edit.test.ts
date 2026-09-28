/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getScheduleByIdMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleById: (...args: unknown[]) => getScheduleByIdMock(...args),
}));

import { getScheduleForEdit } from "./get-for-edit";

describe("getScheduleForEdit", () => {
  afterEach(() => {
    requireDashboardAdminMock.mockReset();
    getScheduleByIdMock.mockReset();
  });

  it("rejects callers who are not active admins", async () => {
    // Setup
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = getScheduleForEdit("schedule-1");

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(getScheduleByIdMock).not.toHaveBeenCalled();
  });

  it("returns the serialized schedule for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    getScheduleByIdMock.mockResolvedValue({
      id: "schedule-1",
      name: "Daily",
      description: null,
      repeat: "repeating",
      cronExpression: "0 0 * * *",
      interval: null,
      timezone: "UTC",
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      pipelineId: "pipeline-1",
      retryConfig: { attempts: 3 },
      executionConfig: null,
      priority: 0,
      enabled: true,
    });

    // Act
    const result = await getScheduleForEdit("schedule-1");

    // Assert
    expect(result).toMatchObject({
      id: "schedule-1",
      startAt: "2026-01-01T00:00:00.000Z",
      retryConfig: { attempts: 3 },
      executionConfig: null,
    });
  });
});
