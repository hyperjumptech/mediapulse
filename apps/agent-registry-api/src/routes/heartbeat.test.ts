import * as apiUtils from "@workspace/api-utils";
import { prisma } from "@workspace/database";
import { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { heartbeat } from "./heartbeat";

vi.mock("@workspace/database", () => ({
  prisma: {
    agentInstance: {
      upsert: vi.fn(),
    },
    agentRegistry: {
      findUnique: vi.fn(),
    },
  },
  AgentStatus: {
    active: "active",
    inactive: "inactive",
    unhealthy: "unhealthy",
  },
}));

vi.mock("@workspace/api-utils", () => ({
  validateBody: vi.fn(),
}));

describe("heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle heartbeat successfully (upsert)", async () => {
    // Setup
    const mockContext = {
      get: vi.fn().mockReturnValue({ error: vi.fn() }),
      json: vi
        .fn()
        .mockImplementation(
          (data, status) =>
            new Response(JSON.stringify(data), { status: status || 200 }),
        ),
    } as unknown as Context;

    vi.mocked(apiUtils.validateBody).mockResolvedValue({
      instanceId: "inst-1",
      agentId: "agent-1",
      agentVersion: "1.0.0",
      status: "active",
      currentLoad: 5,
    });

    vi.mocked(prisma.agentRegistry.findUnique).mockResolvedValue({
      agentId: "agent-1",
      agentVersion: "1.0.0",
      endpoint: { url: "http://localhost:4001", method: "POST" },
    } as any);

    const mockDate = new Date();
    vi.mocked(prisma.agentInstance.upsert).mockResolvedValue({
      lastHeartbeat: mockDate,
    } as any);

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(apiUtils.validateBody).toHaveBeenCalledWith(
      mockContext,
      expect.any(Object),
    );
    expect(prisma.agentRegistry.findUnique).toHaveBeenCalled();
    expect(prisma.agentInstance.upsert).toHaveBeenCalledWith({
      where: { instanceId: "inst-1" },
      update: {
        lastHeartbeat: expect.any(Date),
        status: "active",
        currentLoad: 5,
      },
      create: {
        instanceId: "inst-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        endpoint: { url: "http://localhost:4001", method: "POST" },
        status: "active",
        currentLoad: 5,
        capacity: 10,
        lastHeartbeat: expect.any(Date),
      },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      lastHeartbeat: mockDate.toISOString(),
    });
  });

  it("should handle agent registry not found", async () => {
    // Setup
    const mockContext = {
      get: vi.fn().mockReturnValue({ error: vi.fn() }),
      json: vi
        .fn()
        .mockImplementation(
          (data, status) =>
            new Response(JSON.stringify(data), { status: status || 200 }),
        ),
    } as unknown as Context;

    vi.mocked(apiUtils.validateBody).mockResolvedValue({
      instanceId: "inst-1",
      agentId: "missing-agent",
      agentVersion: "1.0.0",
    });

    vi.mocked(prisma.agentRegistry.findUnique).mockResolvedValue(null);

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      message: "Agent registry not found",
    });
  });

  it("should handle validation error", async () => {
    // Setup
    const mockContext = {
      get: vi.fn().mockReturnValue({ error: vi.fn() }),
    } as unknown as Context;

    const validationResponse = new Response("Bad Request", { status: 400 });
    vi.mocked(apiUtils.validateBody).mockRejectedValue(validationResponse);

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(response).toBe(validationResponse);
  });

  it("should handle internal server error", async () => {
    // Setup
    const mockLogger = { error: vi.fn() };
    const mockContext = {
      get: vi.fn().mockReturnValue(mockLogger),
      json: vi
        .fn()
        .mockImplementation(
          (data, status) =>
            new Response(JSON.stringify(data), { status: status || 200 }),
        ),
    } as unknown as Context;

    vi.mocked(apiUtils.validateBody).mockResolvedValue({
      instanceId: "inst-1",
      agentId: "agent-1",
      agentVersion: "1.0.0",
    });

    vi.mocked(prisma.agentRegistry.findUnique).mockResolvedValue({
      agentId: "agent-1",
      agentVersion: "1.0.0",
      endpoint: { url: "http://localhost:4001", method: "POST" },
    } as any);

    const error = new Error("DB Error");
    vi.mocked(prisma.agentInstance.upsert).mockRejectedValue(error);

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: error },
      "Heartbeat error",
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      message: "Internal server error",
    });
  });
});
