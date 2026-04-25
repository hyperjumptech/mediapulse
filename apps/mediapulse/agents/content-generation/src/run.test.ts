/** @vitest-environment node */
import type { AgentRunResult } from "@workspace/agent-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentGenerationConfig } from "./config-schema.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const contentGenerationGet = vi.fn();
const contentGenerationCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    contentGeneration: {
      get: contentGenerationGet,
      create: contentGenerationCreate,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-content-generation", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    PORT: 4002,
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Must be imported after vi.mock setup
import { run } from "./run.js";
import * as LlmGenerate from "./llm-generate-newsletter.js";
import { resolveContentGenerationConfig } from "./config-schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig = resolveContentGenerationConfig({
  openaiApiKey: "sk-test",
});

function makeContext(overrides?: {
  input?: { tickerId: string };
  config?: Partial<ContentGenerationConfig>;
  token?: string;
}) {
  return {
    input: overrides?.input ?? { tickerId: "ticker-1" },
    config: { ...baseConfig, ...overrides?.config },
    token: overrides?.token ?? "Bearer test",
  };
}

const testSources = [
  {
    url: "https://example.com/a",
    title: "Story A",
    content: "Content for story A.",
    tickerId: "ticker-1",
    searchQueryId: "00000000-0000-4000-8000-000000000001",
  },
];

const generatedNewsletter = {
  subject: "Daily Briefing",
  content: "EXECUTIVE SUMMARY\nMarkets rose.\n\nTOP 3 NEWS\n1. Story A",
  description: "Markets rose for the third day.",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("run", () => {
  beforeEach(() => {
    contentGenerationGet.mockReset();
    contentGenerationCreate.mockReset();
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns success when sources exist and LLM and persist succeed", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // No sources → skipped outcome
  // -------------------------------------------------------------------------

  it("returns success:false with 'no sources found' message when no sources", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: [] });

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("No data sources found");
    }
    expect(LlmGenerate.generateNewsletterWithLlm).not.toHaveBeenCalled();
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  it("returns success:false when dataSources is null", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: null });

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("No data sources found");
    }
  });

  // -------------------------------------------------------------------------
  // LLM errors → OutcomeCode in message
  // -------------------------------------------------------------------------

  it("returns success:false with openai_non_retryable on auth failure", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    const { APICallError } = await import("ai");
    const authError = new APICallError({
      message: "Unauthorized",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      authError,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("openai_non_retryable");
    }
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  it("returns success:false with validation_failed on TypeValidationError", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    const { TypeValidationError } = await import("ai");
    const validationError = new TypeValidationError({
      value: { wrong: "shape" },
      cause: new Error("zod"),
    });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      validationError,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("validation_failed");
    }
  });

  it("returns success:false with openai_retry_exhausted on exhausted retries", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    const { APICallError } = await import("ai");
    const retryableError = new APICallError({
      message: "Too Many Requests",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      retryableError,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("openai_retry_exhausted");
    }
  });

  it("returns success:false with openai_invalid_response on NoObjectGeneratedError", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    const { NoObjectGeneratedError } = await import("ai");
    const noObjectError = Object.assign(
      Object.create(NoObjectGeneratedError.prototype) as InstanceType<
        typeof NoObjectGeneratedError
      >,
      { message: "No object generated", name: "AI_NoObjectGeneratedError" },
    );
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      noObjectError,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("openai_invalid_response");
    }
  });

  // -------------------------------------------------------------------------
  // Persist errors — retry + classification (MP-CGA-009)
  // -------------------------------------------------------------------------

  it("returns success:false with persist_transient on exhausted persist retries (503)", async () => {
    // Setup — all persist attempts fail with 503
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 503"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_transient");
    }
    // Default persistRetry.maxAttempts is 2
    expect(contentGenerationCreate).toHaveBeenCalledTimes(2);
  });

  it("returns success:false with persist_client_error on 4xx (no retry)", async () => {
    // Setup — 400 is non-retryable, should fail immediately
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 400"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_client_error");
    }
    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
  });

  it("returns success:true when first persist fails 503 and second succeeds", async () => {
    // Setup — first attempt 503, second succeeds
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate
      .mockRejectedValueOnce(new Error("Agent data API error: 503"))
      .mockResolvedValueOnce({ message: "ok" });

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    expect(contentGenerationCreate).toHaveBeenCalledTimes(2);
  });

  it("returns success:false with persist_transient on network error after retry exhaustion", async () => {
    // Setup — ECONNREFUSED is retryable, will exhaust all persistRetry.maxAttempts
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:8081"),
    );

    // Act
    const result = await run(makeContext());

    // Assert — ECONNREFUSED has no parseable status, classified as persist_transient
    // (isRetryablePersistError returns true, retries exhaust, classifyPersistError
    // returns persist_transient for network errors without a status code)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_transient");
    }
    // Default persistRetry.maxAttempts is 2
    expect(contentGenerationCreate).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Propagates config to generateNewsletterWithLlm
  // -------------------------------------------------------------------------

  it("passes resolved config with defaults to generateNewsletterWithLlm", async () => {
    // Setup
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    const generateSpy = vi
      .spyOn(LlmGenerate, "generateNewsletterWithLlm")
      .mockResolvedValue(generatedNewsletter);

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const secondArg = generateSpy.mock.calls[0]![1];
    expect(secondArg.llmRetry.maxAttempts).toBe(3);
    expect(secondArg.llmRetry.baseDelayMs).toBe(500);
    expect(secondArg.llmRetry.jitter).toBe(true);
  });
});
