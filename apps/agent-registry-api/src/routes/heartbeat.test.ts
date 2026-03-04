import * as apiUtils from "@workspace/api-utils";
import { prisma } from "@workspace/database";
import { Context } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { heartbeat } from "./heartbeat";

vi.mock("@workspace/database", () => ({
  prisma: {
    agentInstance: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@workspace/api-utils", () => ({
  validateBody: vi.fn(),
}));

describe("heartbeat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle heartbeat successfully", async () => {
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
      status: "active",
      currentLoad: 5,
    });

    const mockDate = new Date();
    vi.mocked(prisma.agentInstance.update).mockResolvedValue({
      lastHeartbeat: mockDate,
    } as any);

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(apiUtils.validateBody).toHaveBeenCalledWith(
      mockContext,
      expect.any(Object),
    );
    expect(prisma.agentInstance.update).toHaveBeenCalledWith({
      where: { instanceId: "inst-1" },
      data: {
        lastHeartbeat: expect.any(Date),
        status: "active",
        currentLoad: 5,
      },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      lastHeartbeat: mockDate.toISOString(),
    });
  });

  it("should handle instance not found", async () => {
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
    });

    vi.mocked(prisma.agentInstance.update).mockRejectedValue({
      code: "P2025",
    });

    // Act
    const response = await heartbeat(mockContext);

    // Assert
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ success: false, message: "Instance not found" });
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
    });

    const error = new Error("DB Error");
    vi.mocked(prisma.agentInstance.update).mockRejectedValue(error);

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
