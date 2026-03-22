import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@workspace/agent-auth-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-auth-client")>();
  return {
    ...actual,
    createAgentTokenClient: vi.fn(() => ({
      getToken: vi.fn().mockResolvedValue("minted-jwt"),
    })),
  };
});

import { createAgentApp } from "./create-agent-app.js";
import type { AgentRunResult } from "./types.js";

const schema = z.object({ tickerId: z.string().uuid() });
type Input = z.infer<typeof schema>;

const validInput = { tickerId: "11111111-1111-4111-a111-111111111111" };
/** Request body shape: { input, config? }. */
const validBody = { input: validInput };
const authHeaders = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

describe("createAgentApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and Hermes envelope when run returns success true", async () => {
    // Setup
    const run = vi.fn().mockResolvedValue({ success: true } as AgentRunResult);
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
      schemaVersion: number;
      status: string;
    };

    // Assert
    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: {},
      token: "Bearer test-token",
    });
  });

  it("returns 200 and envelope failure when run returns success false", async () => {
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({
          success: false,
          message: "Nothing to do",
        }),
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(validBody),
    });
    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
      message: string;
    };

    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("failure");
    expect(body.message).toBe("Nothing to do");
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
      body: JSON.stringify({ input: { tickerId: "not-a-uuid" } }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns missing required field names when input is absent", async () => {
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
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    // Assert
    expect(res.status).toBe(400);
    expect(body.message).toContain("missing required field(s): input");
    expect(body.requiredFields).toEqual(["input"]);
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

  it("GET /schemas returns inputSchema and configSchema as JSON Schema", async () => {
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
    const res = await app.request("http://localhost/schemas", {
      method: "GET",
    });
    const body = (await res.json()) as {
      inputSchema: unknown;
      configSchema: unknown;
    };

    // Assert
    expect(res.status).toBe(200);
    expect(body.inputSchema).toBeDefined();
    expect(typeof body.inputSchema).toBe("object");
    expect(body.configSchema).toBeDefined();
    expect(typeof body.configSchema).toBe("object");
    expect(
      (body.inputSchema as { properties?: unknown }).properties,
    ).toBeDefined();
  });

  it("passes config from body to run when configSchema is provided", async () => {
    // Setup
    const configSchema = z.object({ limit: z.number().optional() });
    type Config = z.infer<typeof configSchema>;
    const run = vi.fn().mockResolvedValue({ success: true } as AgentRunResult);
    const app = createAgentApp<
      Input,
      typeof schema,
      Config,
      typeof configSchema
    >(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        configSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput, config: { limit: 10 } }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: { limit: 10 },
      token: "Bearer test-token",
    });
  });

  it("accepts missing config even when configSchema has required fields", async () => {
    // Setup
    const requiredConfigSchema = z.object({ limit: z.number() });
    type RequiredConfig = z.infer<typeof requiredConfigSchema>;
    const run = vi.fn().mockResolvedValue({ success: true } as AgentRunResult);
    const app = createAgentApp<
      Input,
      typeof schema,
      RequiredConfig,
      typeof requiredConfigSchema
    >(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        configSchema: requiredConfigSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: {},
      token: "Bearer test-token",
    });
  });

  it("calls registerWithRegistry when autoRegister is set", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    createAgentApp<Input, typeof schema>(
      {
        agentId: "auto-agent",
        agentVersion: "2.0.0",
        inputSchema: schema,
        run: async () => ({ success: true }),
      },
      {
        authApiUrl: "https://auth.test",
        verifyToken: async () => true,
        autoRegister: {
          registryUrl: "https://registry.test",
          domainIntegrationApiKey: "sched-key",
          agentUrl: "https://agent.test",
          fetchFn,
        },
      },
    );

    await new Promise<void>((r) => setImmediate(r));

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://registry.test/api/agents/register");
    expect(options.headers.Authorization).toBe("Bearer minted-jwt");
    const body = JSON.parse(options.body);
    expect(body.agentId).toBe("auto-agent");
    expect(body.agentVersion).toBe("2.0.0");
    expect(body.endpoint).toEqual({
      url: "https://agent.test",
      method: "POST",
    });
    expect(body.inputSchema).toBeDefined();
    expect(body.configSchema).toBeDefined();
  });

  it("sends config description in register body when autoRegister is set", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    createAgentApp<Input, typeof schema>(
      {
        agentId: "desc-agent",
        agentVersion: "1.0.0",
        description: "My agent",
        inputSchema: schema,
        run: async () => ({ success: true }),
      },
      {
        authApiUrl: "https://auth.test",
        verifyToken: async () => true,
        autoRegister: {
          registryUrl: "https://registry.test",
          domainIntegrationApiKey: "sched-key",
          agentUrl: "https://agent.test",
          fetchFn,
        },
      },
    );

    await new Promise<void>((r) => setImmediate(r));

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, options] = fetchFn.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    const body = JSON.parse(options.body);
    expect(body.description).toBe("My agent");
  });
});
