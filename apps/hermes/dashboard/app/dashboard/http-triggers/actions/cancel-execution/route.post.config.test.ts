/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCancelHttpTriggerExecutionHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

vi.mock("@/lib/hermes-job-queue", () => ({
  getHermesJobQueue: vi.fn(() => ({})),
}));

describe("createCancelHttpTriggerExecutionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not found when the execution is missing", async () => {
    const db = {
      httpTriggerExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const handler = createCancelHttpTriggerExecutionHandler({
      db: db as never,
      cancelExecution: vi.fn(),
    });

    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000010",
        httpTriggerExecutionId: "00000000-0000-4000-8000-000000000020",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "HTTP trigger execution not found",
    );
  });

  it("returns ok when cancel succeeds", async () => {
    const cancelExecution = vi.fn().mockResolvedValue({ ok: true });
    const db = {
      httpTriggerExecution: {
        findFirst: vi.fn().mockResolvedValue({ id: "ex1" }),
      },
    };
    const handler = createCancelHttpTriggerExecutionHandler({
      db: db as never,
      cancelExecution,
    });

    const result = await handler({
      body: {
        httpTriggerId: "00000000-0000-4000-8000-000000000010",
        httpTriggerExecutionId: "00000000-0000-4000-8000-000000000020",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
  });
});
