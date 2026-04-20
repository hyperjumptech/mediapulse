/** @vitest-environment node */
import type { AgentRunResult } from "@workspace/agent-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentGenerationConfig } from "./config-schema.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const contentGenerationGet = vi.fn();
const contentGenerationCreate = vi.fn();
const contentGenerationNewslettersLatestGet = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    contentGeneration: {
      get: contentGenerationGet,
      create: contentGenerationCreate,
    },
    contentGenerationNewslettersLatest: {
      get: contentGenerationNewslettersLatestGet,
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
import * as FreshnessWindow from "./freshness-window.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig = {
  openaiApiKey: "sk-test",
} as any as ContentGenerationConfig;

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
    contentGenerationNewslettersLatestGet.mockReset();
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
  // Skip-if-fresh: newsletter exists in window → skipped
  // -------------------------------------------------------------------------

  it("returns success:false with skipped message when a fresh newsletter already exists for the ticker today", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: true,
      newsletterId: "nl-existing-123",
    });

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain(
        "Newsletter already generated for ticker-1 today (skipped)",
      );
    }
    expect(contentGenerationGet).not.toHaveBeenCalled();
    expect(LlmGenerate.generateNewsletterWithLlm).not.toHaveBeenCalled();
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Skip-if-fresh: newsletter exists outside window → not skipped, proceeds
  // -------------------------------------------------------------------------

  it("proceeds normally when no fresh newsletter exists for the ticker today", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    expect(contentGenerationGet).toHaveBeenCalledTimes(1);
    expect(LlmGenerate.generateNewsletterWithLlm).toHaveBeenCalledTimes(1);
    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Skip-if-fresh: verifies freshness window is computed with config timezone
  // -------------------------------------------------------------------------

  it("uses configured timezone from freshness config for the precheck window", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    const computeSpy = vi.spyOn(FreshnessWindow, "computeFreshnessWindow");

    // Act
    await run(
      makeContext({
        config: { freshness: { timezone: "America/New_York" } } as any,
      }),
    );

    // Assert
    expect(computeSpy).toHaveBeenCalledWith("America/New_York");
  });

  // -------------------------------------------------------------------------
  // Skip-if-fresh: logs warning when precheck takes longer than 100ms
  // -------------------------------------------------------------------------

  it("logs a warning when the freshness precheck takes longer than 100ms", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ hasNewsletter: false, newsletterId: null }),
            150,
          );
        }),
    );
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    vi.useFakeTimers();
    // Need to advance timers for the setTimeout in the mock
    const resultPromise = run(makeContext());

    // Advance past the 150ms delay and other async operations
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    // Assert - the logger.warn should have been called for the slow precheck
    const { logger } = await import("@workspace/logger");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        precheckDurationMs: expect.any(Number),
      }),
      "Freshness precheck took longer than 100ms",
    );

    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // LLM errors → OutcomeCode in message
  // -------------------------------------------------------------------------

  it("returns success:false with openai_non_retryable on auth failure", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
  // Persist errors → outcome codes
  // -------------------------------------------------------------------------

  it("returns success:false with persist_transient on 429 from agent-data-api", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 429"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_transient");
    }
  });

  it("returns success:false with persist_transient on 500 from agent-data-api", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 500"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_transient");
    }
  });

  it("returns success:false with persist_client_error on 400 from agent-data-api", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
  });

  it("returns success:false with persist_client_error on 404 from agent-data-api", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 404"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_client_error");
    }
  });

  // -------------------------------------------------------------------------
  // Propagates config to generateNewsletterWithLlm
  // -------------------------------------------------------------------------

  it("passes resolved config with defaults to generateNewsletterWithLlm", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
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
