/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/start-domain-event-executions", () => ({
  startDomainEventExecutions: vi.fn(),
}));

import { startDomainEventExecutions } from "@/lib/start-domain-event-executions";

import { POST } from "./route";

const eventRequest = (body: unknown, authorization?: string) =>
  new Request("http://localhost/api/domain-integrations/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
      "x-request-id": "req-7",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/domain-integrations/events", () => {
  it("requires the domain integration API key", async () => {
    const response = await POST(eventRequest({ event: "order.created" }));

    expect(response.status).toBe(401);
  });

  it("rejects an invalid event name", async () => {
    const response = await POST(
      eventRequest({ event: "Order Created" }, "Bearer key"),
    );

    expect(response.status).toBe(400);
  });

  it("returns the started executions", async () => {
    vi.mocked(startDomainEventExecutions).mockResolvedValue({
      status: "started",
      executions: [
        {
          triggerId: "00000000-0000-4000-8000-000000000001",
          executionId: "00000000-0000-4000-8000-000000000002",
        },
      ],
    });

    const response = await POST(
      eventRequest(
        { event: "order.created", params: { orderId: "o-1" } },
        "Bearer key",
      ),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      executions: [
        {
          triggerId: "00000000-0000-4000-8000-000000000001",
          executionId: "00000000-0000-4000-8000-000000000002",
        },
      ],
    });
    expect(startDomainEventExecutions).toHaveBeenCalledWith({
      apiKey: "key",
      request: { event: "order.created", params: { orderId: "o-1" } },
      requestId: "req-7",
    });
  });

  it("maps an unknown API key to 401", async () => {
    vi.mocked(startDomainEventExecutions).mockResolvedValue({
      status: "unauthorized",
    });

    const response = await POST(
      eventRequest({ event: "order.created" }, "Bearer wrong"),
    );

    expect(response.status).toBe(401);
  });
});
