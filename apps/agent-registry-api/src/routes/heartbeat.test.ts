import { describe, expect, it, mock, beforeEach, beforeAll } from "bun:test";
import { Context } from "hono";

// Set up environment variables before any imports
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.TEMP_ADMIN_USERNAME = "test";
  process.env.TEMP_ADMIN_PASSWORD = "test";
});

// Mock the dependencies before importing
const mockValidateBodyFn = mock(() => Promise.resolve({}));
const mockPrismaUpdateFn = mock(() => Promise.resolve({}));

mock.module("@workspace/api-utils", () => ({
  validateBody: mockValidateBodyFn,
}));

mock.module("@workspace/prisma", () => ({
  prisma: {
    agentInstance: {
      update: mockPrismaUpdateFn,
    },
  },
}));

// Import after mocking
const { heartbeat } = await import("./heartbeat");

describe("heartbeat", () => {
  let mockContext: Context;

  beforeEach(() => {
    // Reset all mocks before each test
    mockValidateBodyFn.mockClear();
    mockPrismaUpdateFn.mockClear();

    // Create a mock Hono context
    mockContext = {
      json: mock((data: unknown, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        json: mock(() => Promise.resolve({})),
      },
    } as unknown as Context;
  });

  it("should successfully update agent instance with all fields", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      status: "active",
      currentLoad: 50,
      capacity: 100,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
      status: "ACTIVE",
      currentLoad: 50,
      capacity: 100,
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);
    const responseData = await response.json();

    expect(mockValidateBodyFn).toHaveBeenCalledTimes(1);
    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 100,
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      lastHeartbeat: "2026-02-03T10:00:00.000Z",
    });
  });

  it("should update agent instance with only instanceId", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);
    const responseData = await response.json();

    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        currentLoad: undefined,
        capacity: undefined,
      },
    });
    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
  });

  it("should handle inactive status", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      status: "inactive",
      currentLoad: 0,
      capacity: 100,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
      status: "INACTIVE",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);

    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        status: "INACTIVE",
        currentLoad: 0,
        capacity: 100,
      },
    });
    expect(response.status).toBe(200);
  });

  it("should handle unhealthy status", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      status: "unhealthy",
      currentLoad: 95,
      capacity: 100,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
      status: "UNHEALTHY",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);

    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        status: "UNHEALTHY",
        currentLoad: 95,
        capacity: 100,
      },
    });
    expect(response.status).toBe(200);
  });

  it("should update only currentLoad when provided", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      currentLoad: 75,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);

    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        currentLoad: 75,
        capacity: undefined,
      },
    });
    expect(response.status).toBe(200);
  });

  it("should handle validation errors from validateBody", async () => {
    const validationErrorResponse = new Response(
      JSON.stringify({ message: "instanceId: Required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    mockValidateBodyFn.mockRejectedValue(validationErrorResponse);

    const response = await heartbeat(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toEqual({ message: "instanceId: Required" });
  });

  it("should handle database errors", async () => {
    const mockBody = {
      instanceId: "non-existent-id",
      status: "active",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockRejectedValue(new Error("Record not found"));

    const response = await heartbeat(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
  });

  it("should handle Response errors from validateBody", async () => {
    const errorResponse = new Response(
      JSON.stringify({ message: "Invalid request body" }),
      { status: 400 },
    );

    mockValidateBodyFn.mockRejectedValue(errorResponse);

    const response = await heartbeat(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.message).toBe("Invalid request body");
  });

  it("should not include status in update data when status is undefined", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      currentLoad: 50,
      capacity: 100,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    await heartbeat(mockContext);

    const updateCall = mockPrismaUpdateFn.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("status");
    expect(updateCall.data.currentLoad).toBe(50);
    expect(updateCall.data.capacity).toBe(100);
  });

  it("should handle zero values for currentLoad and capacity", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
      currentLoad: 0,
      capacity: 0,
    };

    const mockUpdateResult = {
      id: "test-instance-id",
      lastHeartbeat: new Date("2026-02-03T10:00:00Z"),
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaUpdateFn.mockResolvedValue(mockUpdateResult);

    const response = await heartbeat(mockContext);

    expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
      data: {
        currentLoad: 0,
        capacity: 0,
      },
    });
    expect(response.status).toBe(200);
  });
});
