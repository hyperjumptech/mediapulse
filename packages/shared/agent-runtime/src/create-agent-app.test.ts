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
import {
  HERMES_HEADER_EXECUTION_ID,
  HERMES_HEADER_JOB_ID,
  HERMES_HEADER_PIPELINE_STEP_ID,
  HERMES_HEADER_SCHEDULE_EXECUTION_ID,
  HERMES_HEADER_SCHEDULE_ID,
} from "./hermes-invoke-correlation.js";
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

  it("GET /health returns domain health contract JSON without Authorization", async () => {
    const app = createAgentApp<Input, typeof schema>(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => false },
    );

    const res = await app.request("http://localhost/health", { method: "GET" });
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      version?: string;
    };

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "test-agent",
      version: "1.0.0",
    });
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

  it("GET /schemas applies textarea format to prompts string fields", async () => {
    const configSchema = z.object({
      openaiApiKey: z.string(),
      prompts: z
        .object({
          systemPrompt: z.string().optional(),
          userPromptTemplate: z.string().optional(),
        })
        .optional(),
    });
    type Config = z.infer<typeof configSchema>;
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
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/schemas", {
      method: "GET",
    });
    const body = (await res.json()) as {
      configSchema: {
        properties?: {
          prompts?: {
            properties?: Record<string, { format?: string }>;
          };
        };
      };
    };

    expect(res.status).toBe(200);
    expect(
      body.configSchema.properties?.prompts?.properties?.systemPrompt?.format,
    ).toBe("textarea");
    expect(
      body.configSchema.properties?.prompts?.properties?.userPromptTemplate
        ?.format,
    ).toBe("textarea");
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

  it("passes Hermes schedule headers from request into run when present", async () => {
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        ...authHeaders,
        [HERMES_HEADER_JOB_ID]: "job-a",
        [HERMES_HEADER_EXECUTION_ID]: "exec-h",
        [HERMES_HEADER_SCHEDULE_ID]: "sched-a",
        [HERMES_HEADER_SCHEDULE_EXECUTION_ID]: "exec-b",
        [HERMES_HEADER_PIPELINE_STEP_ID]: "step-c",
      },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: {},
      token: "Bearer test-token",
      hermesCorrelation: {
        jobId: "job-a",
        executionId: "exec-h",
        scheduleId: "sched-a",
        scheduleExecutionId: "exec-b",
        pipelineStepId: "step-c",
      },
    });
  });

  it("returns 400 when config is omitted and configSchema has required fields", async () => {
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput }),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    expect(res.status).toBe(400);
    expect(body.message).toContain("missing required field(s): limit");
    expect(body.requiredFields).toContain("limit");
    expect(run).not.toHaveBeenCalled();
  });

  it("parses omitted config as {} when configSchema allows an empty object", async () => {
    const optionalFieldsConfigSchema = z.object({
      limit: z.number().optional(),
    });
    type OptionalFieldsConfig = z.infer<typeof optionalFieldsConfigSchema>;
    const run = vi.fn().mockResolvedValue({ success: true } as AgentRunResult);
    const app = createAgentApp<
      Input,
      typeof schema,
      OptionalFieldsConfig,
      typeof optionalFieldsConfigSchema
    >(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        configSchema: optionalFieldsConfigSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput }),
    });

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: {},
      token: "Bearer test-token",
    });
  });

  it("returns 400 when config is JSON null and configSchema has required fields", async () => {
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput, config: null }),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    expect(res.status).toBe(400);
    expect(body.message).toContain("missing required field(s): limit");
    expect(body.requiredFields).toContain("limit");
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 400 when config is an empty object and configSchema has required fields", async () => {
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput, config: {} }),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    expect(res.status).toBe(400);
    expect(body.message).toContain("missing required field(s): limit");
    expect(body.requiredFields).toContain("limit");
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 400 when config has wrong types for configSchema", async () => {
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        input: validInput,
        config: { limit: "not-a-number" },
      }),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    expect(res.status).toBe(400);
    expect(body.message).toBe("Validation failed");
    expect(body.requiredFields).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 400 with nested required path when nested config field is missing", async () => {
    const nestedConfigSchema = z.object({
      api: z.object({ key: z.string().min(1) }),
    });
    type NestedConfig = z.infer<typeof nestedConfigSchema>;
    const run = vi.fn().mockResolvedValue({ success: true } as AgentRunResult);
    const app = createAgentApp<
      Input,
      typeof schema,
      NestedConfig,
      typeof nestedConfigSchema
    >(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        configSchema: nestedConfigSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ input: validInput, config: {} }),
    });
    const body = (await res.json()) as {
      message: string;
      requiredFields: string[];
    };

    expect(res.status).toBe(400);
    expect(body.requiredFields).toContain("api");
    expect(body.message).toContain("api");
    expect(run).not.toHaveBeenCalled();
  });

  it("passes parsed config and Hermes correlation together when both are present", async () => {
    const configSchema = z.object({ limit: z.number() });
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

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        ...authHeaders,
        [HERMES_HEADER_SCHEDULE_ID]: "sched-z",
        [HERMES_HEADER_SCHEDULE_EXECUTION_ID]: "exec-z",
        [HERMES_HEADER_PIPELINE_STEP_ID]: "step-z",
      },
      body: JSON.stringify({
        input: validInput,
        config: { limit: 42 },
      }),
    });

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith({
      input: validInput,
      config: { limit: 42 },
      token: "Bearer test-token",
      hermesCorrelation: {
        scheduleId: "sched-z",
        scheduleExecutionId: "exec-z",
        pipelineStepId: "step-z",
      },
    });
  });

  it("GET /schemas includes custom configSchema JSON when configSchema is provided", async () => {
    const customConfigSchema = z.object({
      feature: z.boolean(),
    });
    type CustomConfig = z.infer<typeof customConfigSchema>;
    const app = createAgentApp<
      Input,
      typeof schema,
      CustomConfig,
      typeof customConfigSchema
    >(
      {
        agentId: "test-agent",
        agentVersion: "1.0.0",
        inputSchema: schema,
        configSchema: customConfigSchema,
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/schemas", {
      method: "GET",
    });
    const body = (await res.json()) as {
      configSchema: { properties?: Record<string, unknown> };
    };

    expect(res.status).toBe(200);
    expect(body.configSchema.properties).toMatchObject({
      feature: expect.objectContaining({ type: "boolean" }),
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
          domainIntegrationId: "mediapulse",
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
    expect(body.domainIntegrationId).toBe("mediapulse");
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
          domainIntegrationId: "mediapulse",
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
