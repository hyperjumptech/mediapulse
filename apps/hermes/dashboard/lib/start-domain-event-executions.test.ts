/** @vitest-environment node */
import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/start-http-trigger-execution", () => ({
  startHttpTriggerExecution: vi.fn(),
}));

import { startDomainEventExecutions } from "./start-domain-event-executions";

const buildDb = (
  integration: { id: string } | null,
  triggers: Array<{ id: string }>,
) => ({
  domainIntegration: {
    findFirst: vi.fn().mockResolvedValue(integration),
  },
  httpTrigger: {
    findMany: vi.fn().mockResolvedValue(
      triggers.map((trigger) => ({
        ...trigger,
        pipeline: { executionConfig: { stepOrder: "sequential" } },
      })),
    ),
  },
});

describe("startDomainEventExecutions", () => {
  it("rejects an API key that belongs to no domain integration", async () => {
    const db = buildDb(null, []);
    const startExecution = vi.fn();

    const result = await startDomainEventExecutions(
      { apiKey: "wrong", request: { event: "order.created" }, requestId: null },
      { db: db as never, startExecution },
    );

    expect(result).toEqual({ status: "unauthorized" });
    expect(db.domainIntegration.findFirst).toHaveBeenCalledWith({
      where: {
        encryptedPayload: {
          credentialSha256Hex: createHash("sha256")
            .update("wrong")
            .digest("hex"),
        },
      },
      select: { id: true },
    });
    expect(startExecution).not.toHaveBeenCalled();
  });

  it("starts one execution per enabled event trigger of the calling integration", async () => {
    const db = buildDb({ id: "di-1" }, [
      { id: "trigger-a" },
      { id: "trigger-b" },
    ]);
    const startExecution = vi
      .fn()
      .mockResolvedValueOnce("exec-a")
      .mockResolvedValueOnce("exec-b");

    const result = await startDomainEventExecutions(
      {
        apiKey: "key",
        request: { event: "order.created", params: { orderId: "o-1" } },
        requestId: "req-1",
      },
      { db: db as never, startExecution },
    );

    expect(result).toEqual({
      status: "started",
      executions: [
        { triggerId: "trigger-a", executionId: "exec-a" },
        { triggerId: "trigger-b", executionId: "exec-b" },
      ],
    });
    expect(db.httpTrigger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          authType: "DOMAIN_EVENT",
          eventName: "order.created",
          enabled: true,
          pipeline: { domainIntegrationId: "di-1" },
        },
      }),
    );
    expect(startExecution).toHaveBeenCalledWith({
      triggerId: "trigger-a",
      executionConfig: { stepOrder: "sequential" },
      metadata: { source: "domain-event", event: "order.created" },
      requestId: "req-1",
      runParams: { orderId: "o-1" },
    });
  });

  it("reports no executions when nothing listens to the event", async () => {
    const db = buildDb({ id: "di-1" }, []);

    const result = await startDomainEventExecutions(
      { apiKey: "key", request: { event: "nobody.listens" }, requestId: null },
      { db: db as never, startExecution: vi.fn() },
    );

    expect(result).toEqual({ status: "started", executions: [] });
  });

  it("rejects run params Hermes cannot use", async () => {
    const db = buildDb({ id: "di-1" }, [{ id: "trigger-a" }]);

    const result = await startDomainEventExecutions(
      {
        apiKey: "key",
        request: { event: "order.created", params: { "bad key": "x" } },
        requestId: null,
      },
      { db: db as never, startExecution: vi.fn() },
    );

    expect(result).toMatchObject({ status: "invalid_params" });
  });
});
