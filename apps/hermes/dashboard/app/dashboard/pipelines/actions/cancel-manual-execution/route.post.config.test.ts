/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCancelManualExecutionHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const pipelineId = "00000000-0000-4000-8000-000000000010";
const manualExecutionId = "00000000-0000-4000-8000-000000000020";

describe("createCancelManualExecutionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not found when the execution is missing", async () => {
    const db = {
      manualPipelineExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const handler = createCancelManualExecutionHandler({
      db: db as never,
    });

    const result = await handler({
      body: { pipelineId, manualExecutionId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Manual execution not found",
    );
  });

  it("returns not allowed when the session user did not start the run", async () => {
    const db = {
      manualPipelineExecution: {
        findFirst: vi.fn().mockResolvedValue({
          id: manualExecutionId,
          metadata: { initiatedByUserId: "other-user" },
        }),
      },
    };
    const handler = createCancelManualExecutionHandler({
      db: db as never,
    });

    const result = await handler({
      body: { pipelineId, manualExecutionId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Not allowed to cancel this execution",
    );
  });

  it("calls abortLocal and returns ok when mark cancelled succeeds", async () => {
    const abortLocal = vi.fn();
    const markCancelled = vi.fn().mockResolvedValue({ ok: true });
    const db = {
      manualPipelineExecution: {
        findFirst: vi.fn().mockResolvedValue({
          id: manualExecutionId,
          metadata: { initiatedByUserId: "user-1" },
        }),
      },
    };
    const handler = createCancelManualExecutionHandler({
      db: db as never,
      markCancelled,
      abortLocal,
    });

    const result = await handler({
      body: { pipelineId, manualExecutionId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(true);
    expect(abortLocal).toHaveBeenCalledWith(manualExecutionId);
  });
});
