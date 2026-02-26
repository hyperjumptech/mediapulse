import { describe, expect, it, mock, beforeEach, beforeAll } from "bun:test";
import { Context } from "hono";

// Set up environment variables before any imports
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.TEMP_ADMIN_USERNAME = "test";
  process.env.TEMP_ADMIN_PASSWORD = "test";
});

// Mock the dependencies before importing
const mockPrismafindManyFn = mock(() => Promise.resolve([]));

mock.module("@workspace/api-utils", () => ({
  validateBody: mock(() => Promise.resolve({})),
}));

mock.module("@workspace/prisma", () => ({
  prisma: {
    agentInstance: {
      findMany: mockPrismafindManyFn,
    },
  },
}));

// Import after mocking
const { instances } = await import("./instances");

describe("instances", () => {
  let mockContext: Context;

  beforeEach(() => {
    // Reset all mocks before each test
    mockPrismafindManyFn.mockClear();

    // Create a mock Hono context
    mockContext = {
      json: mock((data: unknown, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        query: mock((name: string) => {
          const params: Record<string, string | undefined> = {
            agentId: undefined,
            agentVersion: undefined,
            status: undefined,
            minCapacity: undefined,
          };
          return params[name];
        }),
        json: mock(() => Promise.resolve({})),
      },
    } as unknown as Context;
  });

  it("should return all active instances by default", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 100,
      },
      {
        id: "instance-2",
        agentId: "agent-2",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 75,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should filter instances by agentId", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return agentId
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        agentVersion: undefined,
        status: undefined,
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should filter instances by agentVersion", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "2.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return agentVersion
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: "2.0.0",
        status: undefined,
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        agentVersion: "2.0.0",
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
  });

  it("should filter instances by status INACTIVE", async () => {
    const mockInstances = [
      {
        id: "instance-2",
        agentId: "agent-2",
        agentVersion: "1.0.0",
        status: "INACTIVE",
        currentLoad: 0,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return status
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: undefined,
        status: "INACTIVE",
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        status: "INACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should filter instances by status UNHEALTHY", async () => {
    const mockInstances = [
      {
        id: "instance-3",
        agentId: "agent-3",
        agentVersion: "1.0.0",
        status: "UNHEALTHY",
        currentLoad: 95,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return status
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: undefined,
        status: "UNHEALTHY",
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        status: "UNHEALTHY",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should reject invalid status", async () => {
    // Mock the param function to return invalid status
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: undefined,
        status: "INVALID_STATUS",
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toEqual({ message: "Invalid status" });
    expect(mockPrismafindManyFn).not.toHaveBeenCalled();
  });

  it("should filter instances by minCapacity", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 500,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return minCapacity
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: undefined,
        status: undefined,
        minCapacity: "200",
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        capacity: { gte: 200 },
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should combine multiple filters", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "2.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 500,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return all filters
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        agentVersion: "2.0.0",
        status: "ACTIVE",
        minCapacity: "200",
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        agentVersion: "2.0.0",
        capacity: { gte: 200 },
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockInstances);
  });

  it("should return empty array when no instances match", async () => {
    mockPrismafindManyFn.mockResolvedValue([]);

    // Mock the param function to return filters
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "non-existent-agent",
        agentVersion: undefined,
        status: undefined,
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual([]);
  });

  it("should handle database errors", async () => {
    mockPrismafindManyFn.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
  });

  it("should handle Response errors", async () => {
    const errorResponse = new Response(
      JSON.stringify({ message: "Database error" }),
      { status: 500 },
    );

    mockPrismafindManyFn.mockRejectedValue(errorResponse);

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.message).toBe("Database error");
  });

  it("should handle minCapacity as zero", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 0,
        capacity: 0,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return minCapacity of 0
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        agentVersion: undefined,
        status: undefined,
        minCapacity: "0",
      };
      return params[name];
    });

    const response = await instances(mockContext);

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        capacity: { gte: 0 },
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
  });

  it("should return multiple instances with same filters", async () => {
    const mockInstances = [
      {
        id: "instance-1",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 50,
        capacity: 100,
      },
      {
        id: "instance-2",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 75,
        capacity: 100,
      },
      {
        id: "instance-3",
        agentId: "agent-1",
        agentVersion: "1.0.0",
        status: "ACTIVE",
        currentLoad: 25,
        capacity: 100,
      },
    ];

    mockPrismafindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return agentId only
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        agentVersion: undefined,
        status: undefined,
        minCapacity: undefined,
      };
      return params[name];
    });

    const response = await instances(mockContext);
    const responseData = await response.json();

    expect(mockPrismafindManyFn).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toHaveLength(3);
    expect(responseData).toEqual(mockInstances);
  });
});
