import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAgentApp } from "./create-agent-app.js";
import type { AgentResult } from "./types.js";

const schema = z.object({ tickerId: z.string().uuid() });
type Input = z.infer<typeof schema>;

const validBody = { tickerId: "11111111-1111-4111-a111-111111111111" };
const authHeaders = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

describe("createAgentApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and agentId/agentVersion when run returns success", async () => {
    // Setup
    const run = vi.fn().mockResolvedValue({ success: true } as AgentResult);
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run,
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });
    const body = (await res.json()) as {
      agentId: string;
      agentVersion: string;
    };

    // Assert
    expect(res.status).toBe(200);
    expect(body.agentId).toBe("test-agent");
    expect(body.agentVersion).toBe("1.0.0");
    expect(run).toHaveBeenCalledWith({
      input: validBody,
      token: "Bearer test-token",
    });
  });

  it("returns 400 when body fails validation", async () => {
    // Setup
    const run = vi.fn();
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run,
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ tickerId: "not-a-uuid" }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 401 when verifyToken returns false", async () => {
    // Setup
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => false },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns 404 with skipped and message when run returns success false and statusCode 404", async () => {
    // Setup
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({
          success: false,
          statusCode: 404,
          skipped: true,
          message: "No data",
        }),
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });
    const body = (await res.json()) as {
      agentId: string;
      agentVersion: string;
      skipped?: boolean;
      message?: string;
    };

    // Assert
    expect(res.status).toBe(404);
    expect(body.agentId).toBe("test-agent");
    expect(body.skipped).toBe(true);
    expect(body.message).toBe("No data");
  });

  it("returns 500 when run throws", async () => {
    // Setup
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => {
          throw new Error("run failed");
        },
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });
    const body = (await res.json()) as { message: string };

    // Assert
    expect(res.status).toBe(500);
    expect(body.message).toBe("Internal Server Error");
  });

  it("returns 500 and default payload when run returns success false without statusCode", async () => {
    // Setup
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({ success: false }),
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });
    const body = (await res.json()) as {
      agentId: string;
      agentVersion: string;
    };

    // Assert
    expect(res.status).toBe(500);
    expect(body.agentId).toBe("test-agent");
  });

  it("returns 400 when JSON is malformed", async () => {
    // Setup
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: "{ malformed json",
    });
    const body = (await res.json()) as { message: string };

    // Assert
    expect(res.status).toBe(400);
    expect(body.message).toBe("Malformed JSON");
  });
});
