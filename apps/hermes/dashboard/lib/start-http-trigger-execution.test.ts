/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hermes-job-queue", () => ({ getHermesJobQueue: vi.fn() }));

import { startHttpTriggerExecution } from "./start-http-trigger-execution";

describe("startHttpTriggerExecution", () => {
  it("records the execution, marks the trigger and enqueues the worker job", async () => {
    const db = {
      httpTriggerExecution: {
        create: vi.fn().mockResolvedValue({ id: "exec-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      httpTrigger: { update: vi.fn().mockResolvedValue({}) },
    };
    const jobQueue = { addJob: vi.fn().mockResolvedValue(42) };

    const executionId = await startHttpTriggerExecution(
      {
        triggerId: "trigger-1",
        executionConfig: { stepOrder: "sequential" },
        metadata: { source: "domain-event", event: "order.created" },
        requestId: "req-1",
        runParams: { orderId: "o-1" },
      },
      { db: db as never, jobQueue },
    );

    expect(executionId).toBe("exec-1");
    expect(db.httpTriggerExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        httpTriggerId: "trigger-1",
        effectiveExecutionConfig: { stepOrder: "sequential" },
        runParams: { orderId: "o-1" },
        metadata: expect.objectContaining({
          source: "domain-event",
          event: "order.created",
        }),
      }),
      select: { id: true },
    });
    expect(db.httpTrigger.update).toHaveBeenCalledWith({
      where: { id: "trigger-1" },
      data: { lastTriggeredAt: expect.any(Date) },
    });
    expect(jobQueue.addJob).toHaveBeenCalledWith({
      jobType: "execute_http_trigger",
      payload: { httpTriggerExecutionId: "exec-1" },
      idempotencyKey: "execute_http_trigger:exec-1",
      tags: ["httpTriggerExecution:exec-1"],
    });
    expect(db.httpTriggerExecution.update).toHaveBeenCalledWith({
      where: { id: "exec-1" },
      data: { metadata: expect.any(Object) },
    });
  });
});
