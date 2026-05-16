import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContentGenerationConfigSchema,
  contentGenerationConfigDefaults,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import {
  generateNewsletterWithLlm,
  type GenerateNewsletterObjectArgs,
  type GenerateNewsletterObjectFn,
} from "./llm-generate-newsletter.js";
import type { IndustryNewsletterStructure } from "./industry-newsletter-schema.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal resolved config used across tests. */
const baseConfig = resolveContentGenerationConfig(
  ContentGenerationConfigSchema.parse({ openai: { apiKey: "sk-test" } }),
);

/** A fake sleep that records call count without real delays. */
const noopSleepFn = vi.fn().mockResolvedValue(undefined);

/** Minimal valid industry briefing object returned by the mocked LLM. */
const minimalIndustryBrief = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Market Rally Continues",
  industryPulse: {
    displayHeading: "Pulse",
    prose: "Stocks rose for the third day.",
  },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { text: "B1", articleIndex: 1 },
      { text: "B2", articleIndex: 2 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ text: "D1", articleIndex: 3 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ text: "R1" }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Disruptors",
    prose: "Innovation forward.",
  },
  quickHits: {
    displayHeading: "Quick",
    items: [
      { text: "h1", articleIndex: 1 },
      { text: "h2", articleIndex: 2 },
      { text: "h3", articleIndex: 3 },
      { text: "h4", articleIndex: 1 },
      { text: "h5", articleIndex: 2 },
    ],
  },
  ...patch,
});

/** A successful generateObjectFn stub returning an industry briefing. */
function makeSuccessfulGenerateFn(
  patch: Partial<IndustryNewsletterStructure> = {},
): GenerateNewsletterObjectFn {
  return vi.fn().mockResolvedValue({
    object: { ...minimalIndustryBrief(), ...patch },
  });
}

/** Sources used in tests. */
const testSources = [
  { url: "https://example.com/a", title: "Story A", content: "Content A." },
  { url: "https://example.com/b", title: "Story B", content: "Content B." },
  { url: "https://example.com/c", title: "Story C", content: "Content C." },
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
    expect(result.content).toContain("MP_NEWSLETTER_V2");
    expect(result.content).toContain("Stocks rose for the third day.");
    expect(result.content).toContain("BEGIN quick-hits");
    expect(result.description).toBe("Stocks rose for the third day.");
  });

  it("defaults subject when LLM returns an empty subject string", async () => {
    // Setup
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { ...minimalIndustryBrief(), subject: "" },
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

  it("slices sources to output.topNewsCount when building the user prompt", async () => {
    // Setup — only two articles should appear in {{sourceSummaries}}.
    const config = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        output: { topNewsCount: 2 },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { text: "b1", articleIndex: 1 },
          { text: "b2", articleIndex: 2 },
        ],
      },
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ text: "d1", articleIndex: 1 }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "R",
        bullets: [{ text: "r1", articleIndex: 2 }],
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { text: "h1", articleIndex: 1 },
          { text: "h2", articleIndex: 2 },
          { text: "h3", articleIndex: 1 },
          { text: "h4", articleIndex: 2 },
          { text: "h5", articleIndex: 1 },
        ],
      },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      config,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert — third source URL is never injected because it was not in the prompt slice.
    expect(result.content).not.toContain("https://example.com/c");
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.prompt).toContain("Article 1:");
    expect(callArgs.prompt).toContain("Article 2:");
    expect(callArgs.prompt).not.toContain("Article 3:");
  });

  it("appends a 'Read the full article' line for every top-news item using the matching source URL", async () => {
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

    // Assert — every selected source URL appears in a trailing source line.
    expect(result.content).toContain(
      "Read the full article: https://example.com/a",
    );
    expect(result.content).toContain(
      "Read the full article: https://example.com/b",
    );
    expect(result.content).toContain(
      "Read the full article: https://example.com/c",
    );
  });

  it("does not inject inline phrase-based markdown links into top-news summaries", async () => {
    // Setup — even with strong title/summary overlap, the summary stays plain prose.
    const matchingSources = [
      {
        url: "https://example.com/a",
        title: "Tech stocks gains",
        content: "Content A.",
      },
      {
        url: "https://example.com/b",
        title: "Federal Reserve rates pause",
        content: "Content B.",
      },
      {
        url: "https://example.com/c",
        title: "Crude oil prices fell",
        content: "Content C.",
      },
    ];
    const generateObjectFn = makeSuccessfulGenerateFn({
      industryPulse: {
        displayHeading: "Lead",
        prose: "Plain recap without markdown links in the body.",
      },
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            text: "Big tech posted strong gains for the third consecutive day.",
            articleIndex: 1,
          },
          {
            text: "Federal Reserve held interest rates steady at its latest meeting.",
            articleIndex: 2,
          },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          {
            text: "Crude oil prices fell amid weakening demand concerns.",
            articleIndex: 3,
          },
        ],
      },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      matchingSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert — no inline phrase markdown; URLs only appear on Read-the-full-article lines.
    expect(result.content).not.toMatch(/\[[^\]]+]\(https?:\/\/[^\s)]+\)/);
  });

  it("passes timeout to generateObjectFn when openai.timeoutMs is set", async () => {
    // Setup
    const configWithTimeout = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test", timeoutMs: 5000 },
      }),
    );
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

  it("uses default timeout when openai.timeoutMs is absent", async () => {
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
    const config = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        llmRetry: {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          jitter: false,
        },
      }),
    );
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
    const config = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        llmRetry: {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          jitter: false,
        },
      }),
    );
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const generateObjectFn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({
        object: minimalIndustryBrief({
          subject: "Recovery",
          industryPulse: {
            displayHeading: "Lead",
            prose: "All clear.",
          },
        }),
      });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      config,
      testContext,
      {
        generateObjectFn,
        sleepFn,
      },
    );

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
      object: minimalIndustryBrief({
        subject: "Market Update",
        industryPulse: {
          displayHeading: "Lead",
          prose: "Stocks rose.",
        },
      }),
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
      object: minimalIndustryBrief({
        subject: "No Usage",
        industryPulse: {
          displayHeading: "Lead",
          prose: "No usage data.",
        },
      }),
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
      object: minimalIndustryBrief({
        subject: "Undefined Usage",
        industryPulse: {
          displayHeading: "Lead",
          prose: "Undefined.",
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { text: "a", articleIndex: 1 },
            { text: "b", articleIndex: 2 },
            { text: "c", articleIndex: 3 },
            { text: "d", articleIndex: 1 },
            { text: "e", articleIndex: 2 },
          ],
        },
      }),
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
      { url: "https://example.com/a", title: "Story Z", content: "Content Z." },
      { url: "https://example.com/b", title: "Story Y", content: "Content Y." },
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
      openai: { apiKey: "sk-test" },
      prompts: { systemPrompt: customSystem },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      config,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.systemPrompt).toBe(customSystem);
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.system).toBe(customSystem);
  });

  it("substitutes {{tickerId}} and {{date}} in userPromptTemplate", async () => {
    // Setup
    const customTemplate =
      "Analysis for {{tickerId}} on {{date}}.\n\n{{sourceSummaries}}";
    const config = resolveContentGenerationConfig({
      openai: { apiKey: "sk-test" },
      prompts: { userPromptTemplate: customTemplate },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      config,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.resolvedUserPrompt).toContain(
      `Analysis for ${testContext.tickerId}`,
    );
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
      openai: { apiKey: "sk-test" },
      prompts: { userPromptTemplate: customTemplate },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      config,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert
    expect(result.resolvedUserPrompt).toBe(
      `${testContext.tickerId} report: ${testContext.tickerId}.`,
    );
  });

  it("formats source summaries as numbered articles in the default template", async () => {
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

    // Assert — articles are numbered in the prompt
    expect(result.resolvedUserPrompt).toContain("Article 1: Story A");
    expect(result.resolvedUserPrompt).toContain("Article 2: Story B");
    expect(result.resolvedUserPrompt).toContain("Article 3: Story C");
  });
});
