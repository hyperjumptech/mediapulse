/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleRunStatus } from "@hermes/orchestration-database";

import { createCancelHttpTriggerExecutionHandler } from "./route.post.config";

const request = (executionId: string) =>
  ({
    body: { executionId },
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: { id: "u1", name: "Admin", email: "admin@example.com" },
  }) as never;

describe("createCancelHttpTriggerExecutionHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success when cancellation is applied", async () => {
    // Setup
    const cancelExecution = vi.fn().mockResolvedValue({
      kind: "cancelled",
      runStatus: ScheduleRunStatus.cancelled,
    });
    const handler = createCancelHttpTriggerExecutionHandler({
      cancelExecution: cancelExecution as never,
    });

    // Act
    const result = await handler(
      request("00000000-0000-4000-8000-000000000001"),
    );

    // Assert
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: { ok: true, runStatus: ScheduleRunStatus.cancelled },
    });
  });

  it("returns success when execution is already terminal", async () => {
    // Setup
    const cancelExecution = vi.fn().mockResolvedValue({
      kind: "already_terminal",
      runStatus: ScheduleRunStatus.partial,
    });
    const handler = createCancelHttpTriggerExecutionHandler({
      cancelExecution: cancelExecution as never,
    });

    // Act
    const result = await handler(
      request("00000000-0000-4000-8000-000000000002"),
    );

    // Assert
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: { ok: true, runStatus: ScheduleRunStatus.partial },
    });
  });

  it("returns error when execution is missing", async () => {
    // Setup
    const cancelExecution = vi.fn().mockResolvedValue({
      kind: "not_found",
    });
    const handler = createCancelHttpTriggerExecutionHandler({
      cancelExecution: cancelExecution as never,
    });

    // Act
    const result = await handler(
      request("00000000-0000-4000-8000-000000000003"),
    );

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Execution not found",
    );
  });
});
