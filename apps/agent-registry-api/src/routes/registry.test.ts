import { describe, expect, it, mock, beforeEach, beforeAll } from "bun:test";
import { Context } from "hono";

// Set up environment variables before any imports
beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.TEMP_ADMIN_USERNAME = "test";
  process.env.TEMP_ADMIN_PASSWORD = "test";
});

// Mock the dependencies before importing
const mockPrismaFindManyFn = mock(() => Promise.resolve([]));

mock.module("@workspace/prisma", () => ({
  prisma: {
    agentInstance: {
      findMany: mockPrismaFindManyFn,
    },
  },
}));

// Import after mocking
const { registry } = await import("./registry");

describe("registry", () => {
  let mockContext: Context;

  beforeEach(() => {
    // Reset all mocks before each test
    mockPrismaFindManyFn.mockClear();

    // Create a mock Hono context
    mockContext = {
      json: mock((data: unknown, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        param: mock((name: string) => {
          const params: Record<string, string | undefined> = {
            agentId: undefined,
            enabled: undefined,
          };
          return params[name];
        }),
        json: mock(() => Promise.resolve({})),
      },
    } as unknown as Context;
  });

  it("should return all instances without filters", async () => {
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
        status: "INACTIVE",
        currentLoad: 0,
        capacity: 100,
      },
    ];

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        status: undefined,
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: mockInstances, total: 2 });
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return agentId
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        enabled: undefined,
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: undefined,
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: mockInstances, total: 1 });
  });

  it("should filter instances by enabled true", async () => {
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return enabled=true
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        enabled: "true",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: mockInstances, total: 2 });
  });

  it("should filter instances by enabled false", async () => {
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return enabled=false
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        enabled: "false",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        status: undefined,
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: mockInstances, total: 1 });
  });

  it("should combine agentId and enabled filters", async () => {
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function to return both filters
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        enabled: "true",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: mockInstances, total: 1 });
  });

  it("should return empty array when no instances match", async () => {
    mockPrismaFindManyFn.mockResolvedValue([]);

    // Mock the param function to return filters
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "non-existent-agent",
        enabled: undefined,
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({ instances: [], total: 0 });
  });

  it("should return total count of instances", async () => {
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: "agent-1",
        enabled: "true",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.total).toBe(3);
    expect(responseData.instances).toHaveLength(3);
  });

  it("should handle database errors", async () => {
    mockPrismaFindManyFn.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({ message: "Internal server error" });
  });

  it("should handle Response errors", async () => {
    const errorResponse = new Response(
      JSON.stringify({ message: "DB error" }),
      {
        status: 500,
      },
    );

    mockPrismaFindManyFn.mockRejectedValue(errorResponse);

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.message).toBe("DB error");
  });

  it("should handle case-sensitive enabled parameter", async () => {
    const mockInstances = [];

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function with uppercase TRUE (should not match "true")
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        enabled: "TRUE",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        status: undefined,
      },
    });
    expect(response.status).toBe(200);
  });

  it("should return instances with different statuses when enabled is not true", async () => {
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
        status: "INACTIVE",
        currentLoad: 0,
        capacity: 100,
      },
      {
        id: "instance-3",
        agentId: "agent-3",
        agentVersion: "1.0.0",
        status: "UNHEALTHY",
        currentLoad: 95,
        capacity: 100,
      },
    ];

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function without enabled filter
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        enabled: undefined,
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.total).toBe(3);
    expect(responseData.instances).toHaveLength(3);
  });

  it("should only return ACTIVE instances when enabled=true", async () => {
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

    mockPrismaFindManyFn.mockResolvedValue(mockInstances);

    // Mock the param function with enabled=true
    mockContext.req.param = mock((name: string) => {
      const params: Record<string, string | undefined> = {
        agentId: undefined,
        enabled: "true",
      };
      return params[name];
    });

    const response = await registry(mockContext);
    const responseData = await response.json();

    expect(mockPrismaFindManyFn).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
      },
    });
    expect(response.status).toBe(200);
    expect(responseData.total).toBe(2);
  });
});
