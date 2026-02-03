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
const mockPrismaDeleteFn = mock(() => Promise.resolve({}));

mock.module("@workspace/api-utils", () => ({
  validateBody: mockValidateBodyFn,
}));

mock.module("@workspace/prisma", () => ({
  prisma: {
    agentInstance: {
      delete: mockPrismaDeleteFn,
    },
  },
}));

// Import after mocking
const { deregister } = await import("./deregister");

describe("deregister", () => {
  let mockContext: Context;

  beforeEach(() => {
    // Reset all mocks before each test
    mockValidateBodyFn.mockClear();
    mockPrismaDeleteFn.mockClear();

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

  it("should successfully deregister an agent instance", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
    };

    const mockDeleteResult = {
      id: "test-instance-id",
      agentId: "agent-123",
      status: "ACTIVE",
      currentLoad: 50,
      capacity: 100,
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaDeleteFn.mockResolvedValue(mockDeleteResult);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(mockValidateBodyFn).toHaveBeenCalledTimes(1);
    expect(mockPrismaDeleteFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id" },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      message: "agent test-instance-id deregistered",
    });
  });

  it("should handle validation errors from validateBody", async () => {
    const validationErrorResponse = new Response(
      JSON.stringify({ message: "instanceId: Required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    mockValidateBodyFn.mockRejectedValue(validationErrorResponse);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toEqual({ message: "instanceId: Required" });
    expect(mockPrismaDeleteFn).not.toHaveBeenCalled();
  });

  it("should handle validation errors for invalid instanceId type", async () => {
    const validationErrorResponse = new Response(
      JSON.stringify({
        message: "instanceId: Expected string, received number",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    mockValidateBodyFn.mockRejectedValue(validationErrorResponse);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.message).toBe(
      "instanceId: Expected string, received number",
    );
    expect(mockPrismaDeleteFn).not.toHaveBeenCalled();
  });

  it("should handle database error when instance not found", async () => {
    const mockBody = {
      instanceId: "non-existent-id",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaDeleteFn.mockRejectedValue(
      new Error("Record to delete does not exist"),
    );

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
    expect(mockPrismaDeleteFn).toHaveBeenCalledWith({
      where: { id: "non-existent-id" },
    });
  });

  it("should handle Response errors from validateBody", async () => {
    const errorResponse = new Response(
      JSON.stringify({ message: "Invalid request body" }),
      { status: 400 },
    );

    mockValidateBodyFn.mockRejectedValue(errorResponse);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.message).toBe("Invalid request body");
    expect(mockPrismaDeleteFn).not.toHaveBeenCalled();
  });

  it("should handle generic database errors", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaDeleteFn.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
  });

  it("should deregister agent with special characters in instanceId", async () => {
    const mockBody = {
      instanceId: "test-instance-id-123-abc_def",
    };

    const mockDeleteResult = {
      id: "test-instance-id-123-abc_def",
      agentId: "agent-456",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaDeleteFn.mockResolvedValue(mockDeleteResult);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      message: "agent test-instance-id-123-abc_def deregistered",
    });
    expect(mockPrismaDeleteFn).toHaveBeenCalledWith({
      where: { id: "test-instance-id-123-abc_def" },
    });
  });

  it("should handle Prisma constraint violation errors", async () => {
    const mockBody = {
      instanceId: "test-instance-id",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    const constraintError = new Error("Foreign key constraint failed");
    mockPrismaDeleteFn.mockRejectedValue(constraintError);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
  });

  it("should successfully deregister with UUID format instanceId", async () => {
    const mockBody = {
      instanceId: "550e8400-e29b-41d4-a716-446655440000",
    };

    const mockDeleteResult = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      agentId: "agent-789",
    };

    mockValidateBodyFn.mockResolvedValue(mockBody);
    mockPrismaDeleteFn.mockResolvedValue(mockDeleteResult);

    const response = await deregister(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      message: "agent 550e8400-e29b-41d4-a716-446655440000 deregistered",
    });
  });
});
