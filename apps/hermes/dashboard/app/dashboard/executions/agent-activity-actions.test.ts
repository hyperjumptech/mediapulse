/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const getDashboardAdminMock = vi.fn();
const getAgentActivitiesMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  getDashboardAdmin: () => getDashboardAdminMock(),
}));

vi.mock("@/lib/agent-activity", () => ({
  getAgentActivities: (...args: unknown[]) => getAgentActivitiesMock(...args),
}));

import { fetchAgentActivitiesAction } from "./agent-activity-actions";

describe("fetchAgentActivitiesAction", () => {
  afterEach(() => {
    getDashboardAdminMock.mockReset();
    getAgentActivitiesMock.mockReset();
  });

  it("returns no activity when the caller is not an active admin", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue(null);

    // Act
    const result = await fetchAgentActivitiesAction("job-1");

    // Assert
    expect(result).toEqual([]);
    expect(getAgentActivitiesMock).not.toHaveBeenCalled();
  });

  it("returns activity rows for an active admin", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue({
      id: "u1",
      name: "U",
      email: "u@example.com",
      credentialVersion: 0,
    });
    getAgentActivitiesMock.mockResolvedValue([{ id: "activity-1" }]);

    // Act
    const result = await fetchAgentActivitiesAction("job-1");

    // Assert
    expect(getAgentActivitiesMock).toHaveBeenCalledWith("job-1");
    expect(result).toEqual([{ id: "activity-1" }]);
  });
});
