/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { HERMES_ENQUEUE_CORRELATION_METADATA_KEY } from "@hermes/scheduler/enqueue-diagnostics-correlation";

import { HTTP_TRIGGER_REQUEST_HEADER_REDACTED } from "@/lib/collect-http-trigger-request-snapshot";

vi.mock("@/lib/hermes-job-queue", () => ({
  getHermesJobQueue: vi.fn(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  ScheduleEnqueueStatus: { success: "success" },
  prisma: {
    httpTrigger: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    httpTriggerExecution: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { GET, POST } from "./route";
import { getHermesJobQueue } from "@/lib/hermes-job-queue";
import { prisma } from "@hermes/orchestration-database";
import { hashHttpTriggerToken } from "@/lib/http-trigger-auth";

describe("http trigger invoke route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 when trigger does not exist", async () => {
    // Setup
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue(null);

    // Act
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      {
        params: Promise.resolve({ triggerId: "missing" }),
      },
    );
    const json = (await response.json()) as { error: string };

    // Assert
    expect(response.status).toBe(404);
    expect(json.error).toBe("HTTP trigger not found");
  });

  it("returns 405 when method does not match trigger", async () => {
    // Setup
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue({
      id: "t1",
      method: "GET",
      enabled: true,
      tokenHash: hashHttpTriggerToken("secret"),
      pipeline: { executionConfig: null },
    } as never);

    // Act
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      {
        params: Promise.resolve({ triggerId: "t1" }),
      },
    );

    // Assert
    expect(response.status).toBe(405);
  });

  it("returns 401 when bearer token is invalid", async () => {
    // Setup
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue({
      id: "t1",
      method: "POST",
      enabled: true,
      tokenHash: hashHttpTriggerToken("secret"),
      pipeline: { executionConfig: null },
    } as never);

    // Act
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      {
        params: Promise.resolve({ triggerId: "t1" }),
      },
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("returns 202 and enqueues job on valid invoke", async () => {
    // Setup
    const addJob = vi.fn().mockResolvedValue(1);
    vi.mocked(getHermesJobQueue).mockReturnValue({ addJob } as never);
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue({
      id: "t1",
      method: "POST",
      enabled: true,
      tokenHash: hashHttpTriggerToken("secret"),
      pipeline: { executionConfig: { stepOrder: "sequential" } },
    } as never);
    vi.mocked(prisma.httpTriggerExecution.create).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.httpTriggerExecution.update).mockResolvedValue(
      {} as never,
    );
    vi.mocked(prisma.httpTrigger.update).mockResolvedValue({} as never);

    // Act
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
      }),
      {
        params: Promise.resolve({ triggerId: "t1" }),
      },
    );
    const json = (await response.json()) as {
      executionId: string;
      status: string;
    };

    // Assert
    expect(response.status).toBe(202);
    expect(json.executionId).toBe("e1");
    expect(addJob).toHaveBeenCalledTimes(1);
    expect(addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "execute_http_trigger",
        payload: { httpTriggerExecutionId: "e1" },
      }),
    );
    expect(prisma.httpTriggerExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            requestSnapshotVersion: 1,
            request: expect.objectContaining({
              method: "POST",
            }),
            headers: expect.objectContaining({
              authorization: HTTP_TRIGGER_REQUEST_HEADER_REDACTED,
            }),
            [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: expect.objectContaining({
              requestId: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
              ),
            }),
          }),
        }),
      }),
    );
    expect(prisma.httpTriggerExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1" },
        data: {
          metadata: expect.objectContaining({
            [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: expect.objectContaining({
              requestId: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
              ),
              workerTickId: "1",
            }),
          }),
        },
      }),
    );
  });

  it("persists X-Request-Id and worker DataQueue job id on metadata", async () => {
    const addJob = vi.fn().mockResolvedValue(42);
    vi.mocked(getHermesJobQueue).mockReturnValue({ addJob } as never);
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue({
      id: "t1",
      method: "POST",
      enabled: true,
      tokenHash: hashHttpTriggerToken("secret"),
      pipeline: { executionConfig: null },
    } as never);
    vi.mocked(prisma.httpTriggerExecution.create).mockResolvedValue({
      id: "e-xrid",
    } as never);
    vi.mocked(prisma.httpTriggerExecution.update).mockResolvedValue(
      {} as never,
    );
    vi.mocked(prisma.httpTrigger.update).mockResolvedValue({} as never);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "X-Request-Id": "edge-client-99",
        },
      }),
      {
        params: Promise.resolve({ triggerId: "t1" }),
      },
    );

    expect(response.status).toBe(202);
    expect(prisma.httpTriggerExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: {
              requestId: "edge-client-99",
            },
          }),
        }),
      }),
    );
    expect(prisma.httpTriggerExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-xrid" },
        data: {
          metadata: expect.objectContaining({
            [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: {
              requestId: "edge-client-99",
              workerTickId: "42",
            },
          }),
        },
      }),
    );
  });

  it("supports configured GET method", async () => {
    // Setup
    const addJob = vi.fn().mockResolvedValue(1);
    vi.mocked(getHermesJobQueue).mockReturnValue({ addJob } as never);
    vi.mocked(prisma.httpTrigger.findUnique).mockResolvedValue({
      id: "t2",
      method: "GET",
      enabled: true,
      tokenHash: hashHttpTriggerToken("secret2"),
      pipeline: { executionConfig: null },
    } as never);
    vi.mocked(prisma.httpTriggerExecution.create).mockResolvedValue({
      id: "e2",
    } as never);
    vi.mocked(prisma.httpTriggerExecution.update).mockResolvedValue(
      {} as never,
    );
    vi.mocked(prisma.httpTrigger.update).mockResolvedValue({} as never);

    // Act
    const response = await GET(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer secret2" },
      }),
      {
        params: Promise.resolve({ triggerId: "t2" }),
      },
    );

    // Assert
    expect(response.status).toBe(202);
    expect(addJob).toHaveBeenCalledTimes(1);
    expect(prisma.httpTriggerExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            requestSnapshotVersion: 1,
            request: expect.objectContaining({
              method: "GET",
            }),
          }),
        }),
      }),
    );
  });
});
