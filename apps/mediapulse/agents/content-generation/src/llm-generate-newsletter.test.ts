import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  contentGenerationConfigDefaults,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import {
  generateNewsletterWithLlm,
  type GenerateNewsletterObjectArgs,
  type GenerateNewsletterObjectFn,
} from "./llm-generate-newsletter.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal resolved config used across tests. */
const baseConfig = resolveContentGenerationConfig({
  openaiApiKey: "sk-test",
});

/** A fake sleep that records call count without real delays. */
const noopSleepFn = vi.fn().mockResolvedValue(undefined);

/** A successful generateObjectFn stub. */
function makeSuccessfulGenerateFn(
  overrides: Partial<{
    subject: string;
    executiveSummary: string;
    topNews: Array<{ title: string; summary: string }>;
  }> = {},
): GenerateNewsletterObjectFn {
  return vi.fn().mockResolvedValue({
    object: {
      subject: overrides.subject ?? "Market Rally Continues",
      executiveSummary:
        overrides.executiveSummary ?? "Stocks rose for the third day.",
      topNews: overrides.topNews ?? [
        { title: "Tech gains", summary: "Big tech was up." },
        { title: "Fed pause", summary: "Rates held." },
        { title: "Oil dips", summary: "Crude fell." },
      ],
    },
  });
}

/** Sources used in tests. */
const testSources = [
  { url: "https://example.com/a", title: "Story A", content: "Content A." },
  { url: "https://example.com/b", title: "Story B", content: "Content B." },
];

const testContext = {
  tickerId: "ticker-123",
  date: "2026-04-21",
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — happy path", () => {
  it("returns subject, content body, and description on success", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.subject).toBe("Market Rally Continues");
    expect(result.content).toContain("EXECUTIVE SUMMARY");
    expect(result.content).toContain("Stocks rose for the third day.");
    expect(result.content).toContain("TOP 3 NEWS");
    expect(result.description).toBe("Stocks rose for the third day.");
  });

  it("returns default subject when LLM omits subject field", async () => {
    // Setup
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { executiveSummary: "Summary.", topNews: [] },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.subject).toBe("Your daily briefing");
  });

  it("caps topNews at 3 items even if LLM returns more", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn({
      topNews: [
        { title: "Item 1", summary: "s1" },
        { title: "Item 2", summary: "s2" },
        { title: "Item 3", summary: "s3" },
        { title: "Item 4", summary: "s4" },
        { title: "Item 5", summary: "s5" },
      ],
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert — only first 3 items in content
    expect(result.content).toContain("1. Item 1");
    expect(result.content).toContain("3. Item 3");
    expect(result.content).not.toContain("4. Item 4");
  });

  it("passes timeout to generateObjectFn when openai.timeoutMs is set", async () => {
    // Setup
    const configWithTimeout = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      openai: { timeoutMs: 5000 },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    await generateNewsletterWithLlm(
      testSources,
      configWithTimeout,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.timeout).toBe(5000);
  });

  it("does not pass timeout when openai.timeoutMs is absent", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.timeout).toBe(120000);
  });

  it("always passes maxRetries: 0 to disable SDK-internal retry", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.maxRetries).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Non-retryable errors — short-circuit after 1 attempt
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — non-retryable errors", () => {
  it("throws TypeValidationError immediately (1 attempt) without retrying", async () => {
    // Setup
    const validationError = new TypeValidationError({
      value: { wrong: "shape" },
      cause: new Error("zod"),
    });
    const generateObjectFn = vi.fn().mockRejectedValue(validationError);

    // Act & Assert
    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toThrow(TypeValidationError);

    expect(generateObjectFn).toHaveBeenCalledTimes(1);
    expect(noopSleepFn).not.toHaveBeenCalled();
  });

  it("throws APICallError (401) immediately without retrying", async () => {
    // Setup
    const authError = new APICallError({
      message: "Unauthorized",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });
    const generateObjectFn = vi.fn().mockRejectedValue(authError);

    // Act & Assert
    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toThrow(APICallError);

    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });

  it("throws NoObjectGeneratedError immediately without retrying", async () => {
    // Setup
    const noObjectError = Object.assign(
      Object.create(NoObjectGeneratedError.prototype) as NoObjectGeneratedError,
      { message: "No object generated", name: "AI_NoObjectGeneratedError" },
    );
    const generateObjectFn = vi.fn().mockRejectedValue(noObjectError);

    // Act & Assert
    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toThrow(NoObjectGeneratedError);

    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retryable errors — retry up to maxAttempts
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — retryable errors", () => {
  it("retries exactly maxAttempts times on a 429 rate-limit error", async () => {
    // Setup
    const rateLimitError = new APICallError({
      message: "Too Many Requests",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const config = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitter: false,
      },
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const generateObjectFn = vi.fn().mockRejectedValue(rateLimitError);

    // Act & Assert
    await expect(
      generateNewsletterWithLlm(testSources, config, testContext, {
        generateObjectFn,
        sleepFn,
      }),
    ).rejects.toThrow(APICallError);

    expect(generateObjectFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("succeeds after a transient 500 failure", async () => {
    // Setup
    const serverError = new APICallError({
      message: "Internal Server Error",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
    });
    const config = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitter: false,
      },
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const generateObjectFn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({
        object: {
          subject: "Recovery",
          executiveSummary: "All clear.",
          topNews: [{ title: "Up", summary: "Markets up." }],
        },
      });

    // Act
    const result = await generateNewsletterWithLlm(testSources, config, testContext, {
      generateObjectFn,
      sleepFn,
    });

    // Assert
    expect(result.subject).toBe("Recovery");
    expect(generateObjectFn).toHaveBeenCalledTimes(2);
  });

  it("uses default llmRetry config when llmRetry is not in Hermes config", async () => {
    // Setup
    const rateLimitError = new APICallError({
      message: "Too Many Requests",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const generateObjectFn = vi.fn().mockRejectedValue(rateLimitError);

    // Act & Assert
    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn,
      }),
    ).rejects.toThrow();

    expect(generateObjectFn).toHaveBeenCalledTimes(
      contentGenerationConfigDefaults.llmRetry.maxAttempts,
    );
  });
});

// ---------------------------------------------------------------------------
// Token usage and provenance metadata (MP-CGA-008)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — token usage and provenance", () => {
  it("returns promptTokens, completionTokens, and totalTokens when usage is present", async () => {
    // Setup
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        subject: "Market Update",
        executiveSummary: "Stocks rose.",
        topNews: [{ title: "Gains", summary: "Up." }],
      },
      usage: {
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.promptTokens).toBe(120);
    expect(result.completionTokens).toBe(80);
    expect(result.totalTokens).toBe(200);
  });

  it("returns null for all token fields when usage is absent", async () => {
    // Setup — generateObjectFn returns no usage field
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        subject: "No Usage",
        executiveSummary: "No usage data.",
        topNews: [{ title: "Story", summary: "Summary." }],
      },
      // usage intentionally omitted
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.promptTokens).toBeNull();
    expect(result.completionTokens).toBeNull();
    expect(result.totalTokens).toBeNull();
  });

  it("returns null for all token fields when usage is undefined", async () => {
    // Setup
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        subject: "Undefined Usage",
        executiveSummary: "Undefined.",
        topNews: [],
      },
      usage: undefined,
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.promptTokens).toBeNull();
    expect(result.completionTokens).toBeNull();
    expect(result.totalTokens).toBeNull();
  });

  it("returns systemPrompt as a non-empty string", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(typeof result.systemPrompt).toBe("string");
    expect(result.systemPrompt.length).toBeGreaterThan(0);
  });

  it("returns resolvedUserPrompt that contains source content", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert — sources are embedded in the resolved user prompt
    expect(result.resolvedUserPrompt).toContain("Story A");
    expect(result.resolvedUserPrompt).toContain("Content A.");
    expect(result.resolvedUserPrompt).toContain("Story B");
    expect(result.resolvedUserPrompt).toContain("Content B.");
  });

  it("returns different resolvedUserPrompt for different sources", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();
    const otherSources = [
      { url: "https://example.com/z", title: "Story Z", content: "Content Z." },
    ];

    // Act
    const resultA = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );
    const resultB = await generateNewsletterWithLlm(
      otherSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(resultA.resolvedUserPrompt).not.toBe(resultB.resolvedUserPrompt);
  });
});

// ---------------------------------------------------------------------------
// Prompt wiring and substitution (MP-CGA-003 / MP-CGA-008)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — prompt wiring and substitution", () => {
  it("uses systemPrompt from config when provided", async () => {
    // Setup
    const customSystem = "You are a specialized financial analyst.";
    const config = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      prompts: { systemPrompt: customSystem },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(testSources, config, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    expect(result.systemPrompt).toBe(customSystem);
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.system).toBe(customSystem);
  });

  it("substitutes {{tickerId}} and {{date}} in userPromptTemplate", async () => {
    // Setup
    const customTemplate = "Analysis for {{tickerId}} on {{date}}.\n\n{{sourceSummaries}}";
    const config = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      prompts: { userPromptTemplate: customTemplate },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(testSources, config, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    expect(result.resolvedUserPrompt).toContain(`Analysis for ${testContext.tickerId}`);
    expect(result.resolvedUserPrompt).toContain(`on ${testContext.date}`);
    expect(result.resolvedUserPrompt).toContain("Story A");
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.prompt).toBe(result.resolvedUserPrompt);
  });

  it("handles multiple occurrences of the same placeholder", async () => {
    // Setup
    const customTemplate = "{{tickerId}} report: {{tickerId}}.";
    const config = resolveContentGenerationConfig({
      openaiApiKey: "sk-test",
      prompts: { userPromptTemplate: customTemplate },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(testSources, config, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    expect(result.resolvedUserPrompt).toBe(`${testContext.tickerId} report: ${testContext.tickerId}.`);
  });
});
