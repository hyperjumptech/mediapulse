/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createGetAgentActivitiesHandler } from "./route.post.config";

describe("createGetAgentActivitiesHandler", () => {
  it("returns the job's activity rows", async () => {
    const activities = [
      {
        id: "a1",
        title: "Fetched sources",
        description: null,
        status: "success",
        createdAt: "2026-09-30T00:00:00.000Z",
      },
    ];
    const getActivities = vi.fn().mockResolvedValue(activities);
    const handler = createGetAgentActivitiesHandler({ getActivities });

    const result = await handler({
      body: { jobId: "job-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: { id: "u1", name: "A", email: "a@b.com" },
    } as never);

    expect(getActivities).toHaveBeenCalledWith("job-1");
    expect(result).toMatchObject({ status: true, data: { activities } });
  });
});
