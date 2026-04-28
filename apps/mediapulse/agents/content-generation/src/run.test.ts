/** @vitest-environment node */
import type { AgentRunResult } from "@workspace/agent-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentGenerationConfigSchema,
  type ContentGenerationConfig,
} from "./config-schema.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const contentGenerationGet = vi.fn();
const contentGenerationCreate = vi.fn();
const contentGenerationNewslettersLatestGet = vi.fn();
const contentGenerationRunsCreate = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    contentGeneration: {
      get: contentGenerationGet,
      create: contentGenerationCreate,
    },
    contentGenerationNewslettersLatest: {
      get: contentGenerationNewslettersLatestGet,
    },
    contentGenerationRuns: {
      create: contentGenerationRunsCreate,
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

const TEST_TICKER_ID = "00000000-0000-4000-8000-000000000001" as const;

const baseConfig: ContentGenerationConfig = ContentGenerationConfigSchema.parse(
  {
    openai: { apiKey: "sk-test" },
  },
);

function makeContext(overrides?: {
  input?: { tickerId: string };
  config?: Partial<ContentGenerationConfig>;
  token?: string;
}) {
  return {
    input: overrides?.input ?? { tickerId: TEST_TICKER_ID },
    config: { ...baseConfig, ...overrides?.config },
    token: overrides?.token ?? "Bearer test",
  };
}

const testSources = [
  {
    url: "https://example.com/a",
    title: "Story A",
    content: "Content for story A.",
    tickerId: TEST_TICKER_ID,
    searchQueryId: "00000000-0000-4000-8000-000000000001",
  },
];

const generatedNewsletter = {
  subject: "Daily Briefing",
  content: "EXECUTIVE SUMMARY\nMarkets rose.\n\nTOP 3 NEWS\n1. Story A",
  description: "Markets rose for the third day.",
  // Provenance fields added by MP-CGA-008 — included here so all mocks that
  // return generatedNewsletter satisfy the GeneratedContentWithProvenance type.
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  systemPrompt: "You are a newsletter writer for busy executives.",
  resolvedUserPrompt:
    "Create a newsletter from these data sources.\n\nSource: Story A\nContent for story A.",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("run", () => {
  beforeEach(() => {
    contentGenerationGet.mockReset();
    contentGenerationCreate.mockReset();
    contentGenerationNewslettersLatestGet.mockReset();
    contentGenerationRunsCreate.mockReset();
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
        `Newsletter already generated for ${TEST_TICKER_ID} today (skipped)`,
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

  it("passes tickerId and current date to generateNewsletterWithLlm", async () => {
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
    await run(makeContext());

    // Assert
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const thirdArg = generateSpy.mock.calls[0]![2];
    expect(thirdArg.tickerId).toBe(TEST_TICKER_ID);
    expect(thirdArg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // -------------------------------------------------------------------------
  // Diagnostic write: calls contentGenerationRuns.create on every outcome path
  // -------------------------------------------------------------------------

  describe("diagnostic write", () => {
    it("calls contentGenerationRuns.create with outcome=success on the happy path", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationCreate.mockResolvedValue({ message: "ok" });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(true);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("success");
      expect(callArg.stage).toBeNull();
      expect(callArg.errorCode).toBeNull();
      expect(callArg.errorCategory).toBeNull();
      expect(callArg.agentId).toBe("content-generation");
      expect(callArg.tickerId).toBe(TEST_TICKER_ID);
      expect(callArg.durationMs).toBeGreaterThanOrEqual(0);
      expect(callArg.message).toBe(`tickerId=${TEST_TICKER_ID}`);
    });

    it("calls contentGenerationRuns.create with outcome=skipped / errorCode=no_sources on no-sources path", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: [] });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-2" });

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(false);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("skipped");
      expect(callArg.stage).toBe("precheck");
      expect(callArg.errorCode).toBe("no_sources");
      expect(callArg.errorCategory).toBeNull();
      expect(callArg.newsletterId).toBeNull();
      expect(callArg.message).toBe(
        `tickerId=${TEST_TICKER_ID} outcome=no_sources stage=precheck`,
      );
    });

    it("calls contentGenerationRuns.create with outcome=skipped / errorCode=skipped_fresh_newsletter_exists when fresh newsletter exists", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: true,
        newsletterId: "nl-existing-123",
      });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-3" });

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(false);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("skipped");
      expect(callArg.stage).toBe("precheck");
      expect(callArg.errorCode).toBe("skipped_fresh_newsletter_exists");
      expect(callArg.errorCategory).toBeNull();
      expect(callArg.newsletterId).toBeNull();
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=llm / errorCode=openai_non_retryable on auth failure", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-4" });
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
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("llm");
      expect(callArg.errorCode).toBe("openai_non_retryable");
      expect(callArg.errorCategory).toBe("non_retryable_llm");
      expect(callArg.newsletterId).toBeNull();
      expect(callArg.message).toBe(
        `tickerId=${TEST_TICKER_ID} outcome=openai_non_retryable stage=llm`,
      );
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=llm / errorCode=openai_retry_exhausted on retryable LLM error", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-5" });
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
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("llm");
      expect(callArg.errorCode).toBe("openai_retry_exhausted");
      expect(callArg.errorCategory).toBe("retryable_llm");
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=llm / errorCode=openai_invalid_response on NoObjectGeneratedError", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-6" });
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
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("llm");
      expect(callArg.errorCode).toBe("openai_invalid_response");
      expect(callArg.errorCategory).toBe("non_retryable_llm");
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=validate / errorCode=validation_failed on TypeValidationError", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-7" });
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
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("validate");
      expect(callArg.errorCode).toBe("validation_failed");
      expect(callArg.errorCategory).toBe("validation");
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=persist / errorCode=persist_transient on 429 persist error", async () => {
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
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-8" });

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(false);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("persist");
      expect(callArg.errorCode).toBe("persist_transient");
      expect(callArg.errorCategory).toBe("persistence");
      expect(callArg.newsletterId).toBeNull();
    });

    it("calls contentGenerationRuns.create with outcome=failed / stage=persist / errorCode=persist_client_error on 400 persist error", async () => {
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
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-9" });

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(false);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("failed");
      expect(callArg.stage).toBe("persist");
      expect(callArg.errorCode).toBe("persist_client_error");
      expect(callArg.errorCategory).toBe("persistence");
    });

    it("swallows diagnostic write failure and does not change the primary AgentRunResult", async () => {
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
      contentGenerationRunsCreate.mockRejectedValue(
        new Error("Diagnostic API unreachable"),
      );

      // Act
      const result = await run(makeContext());

      // Assert — primary result is unchanged
      expect(result.success).toBe(true);
      // The diagnostic error is logged but does not propagate
      const { logger } = await import("@workspace/logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ tickerId: TEST_TICKER_ID }),
        "Failed to write diagnostic record",
      );
    });

    it("includes a positive durationMs in the diagnostic call", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationCreate.mockResolvedValue({ message: "ok" });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-dur" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      // Act
      await run(makeContext());

      // Assert
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(typeof callArg.durationMs).toBe("number");
      expect(callArg.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("forwards pipelineRunId from hermesCorrelation.pipelineStepId when present", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationCreate.mockResolvedValue({ message: "ok" });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-pipe" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      // Act
      await run({
        ...makeContext(),
        hermesCorrelation: { pipelineStepId: "step-abc-123" },
      });

      // Assert
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.pipelineRunId).toBe("step-abc-123");
    });

    it("sets pipelineRunId to null when hermesCorrelation is absent", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationCreate.mockResolvedValue({ message: "ok" });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-nopipe" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      // Act
      await run(makeContext()); // no hermesCorrelation

      // Assert
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.pipelineRunId).toBeNull();
    });

    it("forwards newsletterId from persist response to the diagnostic record on success", async () => {
      // Setup
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue({ dataSources: testSources });
      contentGenerationCreate.mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000099",
        message: "ok",
      });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-nl" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      // Act
      const result = await run(makeContext());

      // Assert
      expect(result.success).toBe(true);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("success");
      expect(callArg.newsletterId).toBe("00000000-0000-4000-8000-000000000099");
    });
  });
});

// ---------------------------------------------------------------------------
// Provenance fields (MP-CGA-008)
// ---------------------------------------------------------------------------

describe("provenance fields in contentGeneration.create", () => {
  beforeEach(() => {
    contentGenerationGet.mockReset();
    contentGenerationCreate.mockReset();
    contentGenerationNewslettersLatestGet.mockReset();
    contentGenerationRunsCreate.mockReset();
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Builds a `GeneratedContentWithProvenance`-shaped mock return value that
   * includes both the newsletter content and the provenance metadata returned
   * by the extended `generateNewsletterWithLlm`.
   */
  const provenanceDefaults = {
    promptTokens: 100 as number | null,
    completionTokens: 50 as number | null,
    totalTokens: 150 as number | null,
    systemPrompt: "You are a newsletter writer for busy executives.",
    resolvedUserPrompt:
      "Create a newsletter from these data sources.\n\nSource: Story A\nContent for story A.",
  };

  function makeGeneratedWithProvenance(
    overrides?: Partial<typeof provenanceDefaults>,
  ) {
    // Use object spread so explicit null overrides are preserved.
    // Do NOT use ?? here - null ?? default replaces null with the default,
    // breaking tests that assert on null token fields.
    return { ...generatedNewsletter, ...provenanceDefaults, ...overrides };
  }

  function setupHappyPath(
    generatedOverrides?: Parameters<typeof makeGeneratedWithProvenance>[0],
  ) {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    contentGenerationRunsCreate.mockResolvedValue({});
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      makeGeneratedWithProvenance(generatedOverrides),
    );
  }

  // -------------------------------------------------------------------------
  // Full provenance on success path (AC: all 7 fields populated non-null)
  // -------------------------------------------------------------------------

  it("calls contentGeneration.create with all 7 provenance fields on the success path", async () => {
    // Setup
    setupHappyPath();

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    expect(contentGenerationCreate).toHaveBeenCalledOnce();
    const createArg = contentGenerationCreate.mock.calls[0]![0];

    expect(typeof createArg.model).toBe("string");
    expect(createArg.model.length).toBeGreaterThan(0);

    expect(typeof createArg.agentVersion).toBe("string");
    expect(createArg.agentVersion.length).toBeGreaterThan(0);

    expect(typeof createArg.configVersion).toBe("string");
    expect(createArg.configVersion).toMatch(/^[0-9a-f]{16}$/);

    expect(typeof createArg.promptHash).toBe("string");
    expect(createArg.promptHash).toMatch(/^[0-9a-f]{16}$/);

    expect(typeof createArg.configSnapshotId).toBe("string");
    expect(createArg.configSnapshotId.length).toBeGreaterThan(0);

    // token fields — present in this test (usage was returned)
    expect(createArg.promptTokens).toBe(100);
    expect(createArg.completionTokens).toBe(50);
    expect(createArg.totalTokens).toBe(150);
  });

  // -------------------------------------------------------------------------
  // model comes from config (AC)
  // -------------------------------------------------------------------------

  it("uses the model from config.openai.model as the provenance model field", async () => {
    // Setup
    setupHappyPath();

    // Act
    await run(
      makeContext({
        config: {
          openai: {
            apiKey: "sk-test",
            model: "gpt-4o",
            timeoutMs: 120000,
          },
        },
      }),
    );

    // Assert
    const createArg = contentGenerationCreate.mock.calls[0]![0];
    expect(createArg.model).toBe("gpt-4o");
  });

  // -------------------------------------------------------------------------
  // agentVersion matches constant (AC)
  // -------------------------------------------------------------------------

  it("uses AGENT_VERSION as the agentVersion field", async () => {
    // Setup
    setupHappyPath();

    // Act
    await run(makeContext());

    // Assert
    const createArg = contentGenerationCreate.mock.calls[0]![0];
    expect(createArg.agentVersion).toBe("1.0.0");
  });

  // -------------------------------------------------------------------------
  // configVersion excludes apiKey (AC)
  // -------------------------------------------------------------------------

  it("produces the same configVersion for two runs differing only in openai.apiKey", async () => {
    // Setup — run A with key-alpha
    setupHappyPath();
    await run(
      makeContext({ config: { openai: { apiKey: "sk-key-alpha" } } as any }),
    );
    const createArgA = contentGenerationCreate.mock.calls[0]![0];

    // Reset mocks for run B
    contentGenerationCreate.mockReset();
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      makeGeneratedWithProvenance(),
    );

    // Run B with key-beta (everything else is the same)
    await run(
      makeContext({ config: { openai: { apiKey: "sk-key-beta" } } as any }),
    );
    const createArgB = contentGenerationCreate.mock.calls[0]![0];

    // Assert
    expect(createArgA.configVersion).toBe(createArgB.configVersion);
  });

  // -------------------------------------------------------------------------
  // promptHash sensitivity (AC)
  // -------------------------------------------------------------------------

  it("produces different promptHash values when source content changes", async () => {
    // Setup — run A with Story A sources
    setupHappyPath({
      resolvedUserPrompt:
        "Create a newsletter.\n\nSource: Story A\nContent for story A.",
    });
    await run(makeContext());
    const createArgA = contentGenerationCreate.mock.calls[0]![0];

    // Reset for run B
    contentGenerationCreate.mockReset();
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationCreate.mockResolvedValue({ message: "ok" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      makeGeneratedWithProvenance({
        resolvedUserPrompt:
          "Create a newsletter.\n\nSource: Oil Crisis\nCrude fell sharply today.",
      }),
    );

    await run(makeContext());
    const createArgB = contentGenerationCreate.mock.calls[0]![0];

    // Assert — different source content → different prompt hash
    expect(createArgA.promptHash).not.toBe(createArgB.promptHash);
  });

  // -------------------------------------------------------------------------
  // configSnapshotId falls back to configVersion (AC)
  // -------------------------------------------------------------------------

  it("sets configSnapshotId equal to configVersion when no Hermes snapshot id is available", async () => {
    // Setup
    setupHappyPath();

    // Act — no hermesCorrelation
    await run(makeContext());

    // Assert
    const createArg = contentGenerationCreate.mock.calls[0]![0];
    expect(createArg.configSnapshotId).toBe(createArg.configVersion);
  });

  // -------------------------------------------------------------------------
  // Absent usage → null token fields + warning log (AC)
  // -------------------------------------------------------------------------

  it("passes undefined for token fields and logs a warning when LLM usage is absent", async () => {
    // Setup — no usage data from LLM
    setupHappyPath({
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(true);
    const createArg = contentGenerationCreate.mock.calls[0]![0];
    expect(createArg.promptTokens).toBeUndefined();
    expect(createArg.completionTokens).toBeUndefined();
    expect(createArg.totalTokens).toBeUndefined();

    // Warning must have been logged
    const { logger } = await import("@workspace/logger");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tickerId: TEST_TICKER_ID }),
      "Token usage absent from LLM response; storing null for token fields",
    );
  });

  // -------------------------------------------------------------------------
  // Provenance fields are NOT passed on non-success paths
  // -------------------------------------------------------------------------

  it("does not call contentGeneration.create when LLM generation fails", async () => {
    // Setup
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue({ dataSources: testSources });
    contentGenerationRunsCreate.mockResolvedValue({});
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      new Error("LLM failed"),
    );

    // Act
    const result = await run(makeContext());

    // Assert
    expect(result.success).toBe(false);
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });
});
