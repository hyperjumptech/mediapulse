import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@workspace/logger";

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
import { industryNewsletterStructureSchema } from "./industry-newsletter-schema.js";
import { NEWSLETTER_EXEMPLAR_BANK } from "./lib/newsletter-exemplars.js";
import {
  extractNumericAnchorsFromSources,
  selectTopAnchors,
} from "./lib/numeric-anchors.js";
import { polishNewsletter } from "./lib/newsletter-polish.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal resolved config used across tests (ranking off — legacy prompt order). */
const baseConfig = resolveContentGenerationConfig(
  ContentGenerationConfigSchema.parse({
    openai: { apiKey: "sk-test" },
    sourceRanking: { enabled: false },
  }),
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
    expect(result.content).toContain("MP_NEWSLETTER");
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

// ---------------------------------------------------------------------------
// Source ranking (plan 41)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — source ranking", () => {
  const rankingFixture = Array.from({ length: 10 }, (_, i) => ({
    url:
      i < 6
        ? `https://reuters.com/story-${String(i)}`
        : `https://kontan.co.id/story-${String(i)}`,
    title: i < 6 ? `Reuters ${String(i)}` : `Kontan ${String(i)}`,
    content: `Body ${String(i)}.`,
    publishedAt: new Date(Date.UTC(2026, 4, 22 - i)).toISOString(),
  }));

  it("with sourceRanking.enabled false, prompt matches legacy relevance-only slice", async () => {
    // Setup
    const legacyConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        output: { topNewsCount: 6 },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const disabledResult = await generateNewsletterWithLlm(
      rankingFixture,
      legacyConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const legacyResult = await generateNewsletterWithLlm(
      rankingFixture.slice(0, 6),
      legacyConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert — first six articles in relevance order, byte-identical prompt body
    expect(disabledResult.resolvedUserPrompt).toBe(
      legacyResult.resolvedUserPrompt,
    );
    expect(disabledResult.resolvedUserPrompt).toContain("Article 1: Reuters 0");
    expect(disabledResult.resolvedUserPrompt).toContain("Article 6: Reuters 5");
  });

  it("with sourceRanking.enabled true, reorders articles and caps hosts per maxPerHost", async () => {
    // Setup
    const rankedConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: true, maxPerHost: 2 },
        output: { topNewsCount: 6 },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      rankingFixture,
      rankedConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert — diversified order: 2 reuters, 2 kontan, then spillover reuters
    expect(result.resolvedUserPrompt).toContain("Article 1: Reuters 0");
    expect(result.resolvedUserPrompt).toContain("Article 2: Reuters 1");
    expect(result.resolvedUserPrompt).toContain("Article 3: Kontan 6");
    expect(result.resolvedUserPrompt).toContain("Article 4: Kontan 7");
    expect(result.resolvedUserPrompt).toContain("Article 5: Reuters 2");
    expect(result.resolvedUserPrompt).toContain("Article 6: Reuters 3");
    expect(result.resolvedUserPrompt).not.toContain("Article 1: Kontan");
  });
});

// ---------------------------------------------------------------------------
// Few-shot exemplars (plan 42)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — few-shot exemplars", () => {
  it("with fewShot.enabled false, prompt matches legacy prompt without exemplar framing", async () => {
    // Setup
    const disabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        fewShot: { enabled: false },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      disabledConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.resolvedUserPrompt).not.toContain("EXEMPLAR — ");
    expect(result.resolvedUserPrompt).not.toContain("END EXEMPLAR");
  });

  it("with fewShot.enabled true, resolved user prompt contains exemplar framing", async () => {
    // Setup
    const enabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        fewShot: { enabled: true, maxExemplars: 1 },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      enabledConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.resolvedUserPrompt).toContain("EXEMPLAR — ");
    expect(result.resolvedUserPrompt).toContain("END EXEMPLAR");
    expect(result.resolvedUserPrompt).toContain("Do NOT copy specific facts");
  });

  it("with fewShot.enabled true and exemplar-copied LLM output, logs plagiarism warning", async () => {
    // Setup
    const enabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        fewShot: { enabled: true, maxExemplars: 1, sectorTag: "industrial" },
      }),
    );
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const copiedFromExemplar = NEWSLETTER_EXEMPLAR_BANK[0]!.output;
    const generateObjectFn = makeSuccessfulGenerateFn(copiedFromExemplar);

    // Act
    await generateNewsletterWithLlm(testSources, enabledConfig, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert — parser accepts output; overlap detector fires fail-safe warning
    expect(generateObjectFn).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "newsletter_possibly_plagiarized_exemplar",
      }),
      expect.any(String),
    );
  });

  it("prompt hash diverges when fewShot flag toggles", async () => {
    // Setup
    const disabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        fewShot: { enabled: false },
      }),
    );
    const enabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        fewShot: { enabled: true },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const disabledResult = await generateNewsletterWithLlm(
      testSources,
      disabledConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const enabledResult = await generateNewsletterWithLlm(
      testSources,
      enabledConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(disabledResult.resolvedUserPrompt).not.toBe(
      enabledResult.resolvedUserPrompt,
    );
  });
});

// ---------------------------------------------------------------------------
// Two-pass brainstorm (plan 43)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — two-pass brainstorm", () => {
  const brainstormMemo = [
    "HEADLINE THESIS: Banks slowed but consumer credit held up",
    "THREADS TO WEAVE: deposit growth versus lending margins remain the central tension for regional lenders this week",
    "STANDOUT NUMBERS: 6.1% net interest margin (Article 1)",
    "WHAT CHANGED: policy rate held steady while deposit competition intensified",
    "WHAT TO WATCH: tighter KYC audits on micro-lenders through quarter end",
    "TONE NOTE: sober and analytical — avoid cheerleading on margin expansion",
  ].join("\n");

  const brainstormEnabledConfig = resolveContentGenerationConfig(
    ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
      sourceRanking: { enabled: false },
      useBrainstormPass: true,
    }),
  );

  it("with useBrainstormPass true, structured prompt contains memo and editor framing", async () => {
    // Setup
    const generateTextFn = vi.fn().mockResolvedValue({
      text: brainstormMemo,
      usage: { inputTokens: 400, outputTokens: 180 },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      brainstormEnabledConfig,
      testContext,
      { generateObjectFn, generateTextFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(generateTextFn).toHaveBeenCalledOnce();
    expect(result.brainstormUsed).toBe(true);
    expect(result.brainstormPromptTokens).toBe(400);
    expect(result.brainstormCompletionTokens).toBe(180);
    expect(result.resolvedUserPrompt).toContain("your editor's memo");
    expect(result.resolvedUserPrompt).toContain(
      "HEADLINE THESIS: Banks slowed but consumer credit held up",
    );
  });

  it("with useBrainstormPass false, structured prompt matches legacy single-pass output", async () => {
    // Setup
    const singlePassConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        useBrainstormPass: false,
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const legacyResult = await generateNewsletterWithLlm(
      testSources,
      singlePassConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(legacyResult.brainstormUsed).toBe(false);
    expect(legacyResult.resolvedUserPrompt).not.toContain("your editor's memo");
    expect(legacyResult.resolvedUserPrompt).toContain("Article 1: Story A");
  });

  it("falls back to single-pass when brainstorm throws and logs brainstorm_failed_fallback", async () => {
    // Setup
    const generateTextFn = vi
      .fn()
      .mockRejectedValue(new Error("upstream timeout"));
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      brainstormEnabledConfig,
      testContext,
      { generateObjectFn, generateTextFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.brainstormUsed).toBe(false);
    expect(result.resolvedUserPrompt).not.toContain("your editor's memo");
    expect(generateObjectFn).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "brainstorm_failed_fallback" }),
      expect.any(String),
    );
  });

  it("skips memo when brainstorm consumes more than half the timeout budget", async () => {
    // Setup
    const slowConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test", timeoutMs: 1000 },
        sourceRanking: { enabled: false },
        useBrainstormPass: true,
      }),
    );
    let now = 0;
    const nowFn = vi.fn(() => {
      now += 600;
      return now;
    });
    const generateTextFn = vi.fn().mockResolvedValue({
      text: brainstormMemo,
      usage: { inputTokens: 10, outputTokens: 10 },
    });
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      slowConfig,
      testContext,
      {
        generateObjectFn,
        generateTextFn,
        sleepFn: noopSleepFn,
        nowFn,
      },
    );

    // Assert
    expect(result.brainstormUsed).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "brainstorm_slow_single_pass_fallback",
      }),
      expect.any(String),
    );
  });

  it("structured output stays schema-valid and reflects memo threads and numbers", async () => {
    // Setup
    const structuredObject: IndustryNewsletterStructure = {
      ...minimalIndustryBrief(),
      industryPulse: {
        displayHeading: "Credit hold",
        prose:
          "Deposit growth versus lending margins remain the central tension for regional lenders this week.",
      },
      competitiveLandscape: {
        displayHeading: "Margins",
        bullets: [
          {
            text: "Net interest margin reached 6.1% as deposit competition intensified (Article 1).",
            articleIndex: 1,
          },
          { text: "Peer spreads widened on retail funding.", articleIndex: 2 },
        ],
      },
    };
    const generateTextFn = vi.fn().mockResolvedValue({
      text: brainstormMemo,
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: structuredObject,
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      brainstormEnabledConfig,
      testContext,
      { generateObjectFn, generateTextFn, sleepFn: noopSleepFn },
    );

    // Assert
    const parsed = industryNewsletterStructureSchema.parse(structuredObject);
    expect(
      parsed.competitiveLandscape.bullets.some((bullet) =>
        bullet.text.includes("6.1%"),
      ),
    ).toBe(true);
    expect(parsed.industryPulse.prose.toLowerCase()).toContain(
      "deposit growth",
    );
    expect(result.brainstormUsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Citation grounding (plan 44)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — citation grounding", () => {
  it("keeps quick hits at schema minimum and warns when grounding would drop below floor", async () => {
    // Setup
    const miningSource = {
      url: "https://example.com/mining",
      title: "Nickel output rises",
      content: "Mining contractors shipped higher nickel ore volumes.",
    };
    const badQuickHits = Array.from({ length: 5 }, (_, index) => ({
      text: `Unrelated widget headline ${String(index)}`,
      articleIndex: 1,
    }));
    const generateObjectFn = makeSuccessfulGenerateFn({
      quickHits: {
        displayHeading: "Quick",
        items: badQuickHits,
      },
    });
    const groundingConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        citationGrounding: {
          enabled: true,
          policy: "drop",
          minOverlapScore: 0.18,
        },
      }),
    );
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);

    // Act
    const result = await generateNewsletterWithLlm(
      [miningSource],
      groundingConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.content).toContain("Unrelated widget headline 0");
    expect(result.citationGroundingSummary?.dropped).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "quickHits_ground_failed_keeping_item",
      }),
      expect.any(String),
    );
  });
});

// ---------------------------------------------------------------------------
// Self-critique (plan 45)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — self-critique", () => {
  const critiqueEnabledConfig = resolveContentGenerationConfig(
    ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test", timeoutMs: 1000 },
      sourceRanking: { enabled: false },
      selfCritique: {
        enabled: true,
        dropFraction: 0.2,
        minBulletCount: 8,
        preferRewriteOverDrop: true,
      },
    }),
  );

  it("rewrites low-scored bullets in place when suggestedRewrite is provided", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: "Weak one.", articleIndex: 1 },
          { text: "Weak two.", articleIndex: 1 },
          { text: "Weak three.", articleIndex: 1 },
        ],
      },
    });
    const critiqueGenerateObjectFn = vi.fn().mockResolvedValue({
      object: {
        ratings: [
          {
            sectionKey: "competitiveLandscape",
            bulletIndex: 0,
            specificity: 1,
            citationStrength: 1,
            redundancy: 5,
            readerValue: 1,
            drop: true,
            suggestedRewrite: "Concrete rewrite one.",
            rationale: "Vague.",
          },
          {
            sectionKey: "competitiveLandscape",
            bulletIndex: 1,
            specificity: 1,
            citationStrength: 1,
            redundancy: 5,
            readerValue: 1,
            drop: true,
            suggestedRewrite: "Concrete rewrite two.",
            rationale: "Vague.",
          },
          {
            sectionKey: "competitiveLandscape",
            bulletIndex: 2,
            specificity: 1,
            citationStrength: 1,
            redundancy: 5,
            readerValue: 1,
            drop: true,
            suggestedRewrite: "Concrete rewrite three.",
            rationale: "Vague.",
          },
        ],
      },
      usage: { promptTokens: 50, completionTokens: 25 },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      critiqueEnabledConfig,
      { ...testContext, runStartedAt: 0 },
      {
        generateObjectFn,
        critiqueGenerateObjectFn,
        sleepFn: noopSleepFn,
        nowFn: () => 100,
      },
    );

    // Assert
    expect(critiqueGenerateObjectFn).toHaveBeenCalledOnce();
    expect(result.critiqueSummary?.bulletsRewritten).toBe(2);
    expect(result.content).toContain("Concrete rewrite");
    expect(result.content).toContain("Weak three.");
  });

  it("preserves competitiveLandscape floor when critique would drop below min(2)", async () => {
    // Setup
    const sparseCompetitive = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: "Weak one.", articleIndex: 1 },
          { text: "Weak two.", articleIndex: 1 },
        ],
      },
    });
    const critiqueGenerateObjectFn = vi.fn().mockResolvedValue({
      object: {
        ratings: [
          {
            sectionKey: "competitiveLandscape",
            bulletIndex: 0,
            specificity: 1,
            citationStrength: 1,
            redundancy: 5,
            readerValue: 1,
            drop: true,
            rationale: "Vague.",
          },
          {
            sectionKey: "competitiveLandscape",
            bulletIndex: 1,
            specificity: 1,
            citationStrength: 1,
            redundancy: 5,
            readerValue: 1,
            drop: true,
            rationale: "Vague.",
          },
        ],
      },
      usage: { promptTokens: 1, completionTokens: 1 },
    });

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      critiqueEnabledConfig,
      { ...testContext, runStartedAt: 0 },
      {
        generateObjectFn: sparseCompetitive,
        critiqueGenerateObjectFn,
        sleepFn: noopSleepFn,
        nowFn: () => 100,
      },
    );

    // Assert
    expect(result.content).toContain("Weak one.");
    expect(result.content).toContain("Weak two.");
    expect(result.critiqueSummary?.floorPreserved).toBe(1);
  });

  it("skips critique when bullet count is below minBulletCount", async () => {
    // Setup
    const sparseConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        selfCritique: {
          enabled: true,
          minBulletCount: 10,
        },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();
    const critiqueGenerateObjectFn = vi.fn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      sparseConfig,
      testContext,
      {
        generateObjectFn,
        critiqueGenerateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    // Assert — valid structures have nine critique-eligible bullets
    expect(critiqueGenerateObjectFn).not.toHaveBeenCalled();
    expect(result.critiqueSummary?.bulletsRated).toBe(0);
  });

  it("skips critique when run elapsed exceeds 70% of timeout budget", async () => {
    // Setup
    let currentNow = 0;
    const nowFn = vi.fn(() => {
      currentNow += 800;
      return currentNow;
    });
    const critiqueGenerateObjectFn = vi.fn();

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      critiqueEnabledConfig,
      { ...testContext, runStartedAt: 0 },
      {
        generateObjectFn: makeSuccessfulGenerateFn(),
        critiqueGenerateObjectFn,
        sleepFn: noopSleepFn,
        nowFn,
      },
    );

    // Assert
    expect(critiqueGenerateObjectFn).not.toHaveBeenCalled();
    expect(result.critiqueSkippedDueToBudget).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Numeric anchors (plan 46)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — numeric anchors", () => {
  const anchorRichSources = Array.from({ length: 4 }, (_, index) => ({
    url: `https://example.com/story-${String(index)}`,
    title: `Story ${String(index)}`,
    content: [
      `Revenue reached $${String(2 + index)}.1B this quarter.`,
      `Net profit grew ${String(10 + index)}.2% YoY.`,
      `BCA posted Rp ${String(12 + index)}.4 trillion in earnings.`,
      `The group opened ${String(8 + index)} new branches nationwide.`,
      `Leverage sits at ${String(3 + index)}.5x capital.`,
    ].join(" "),
  }));

  it("reports anchor coverage when enabled and the briefing quotes top anchors", async () => {
    // Setup
    const extracted = extractNumericAnchorsFromSources(anchorRichSources);
    const topAnchors = selectTopAnchors(extracted, 5, 25);
    const quotedFigures = topAnchors.slice(0, 6).map((anchor) => anchor.raw);
    expect(extracted.length).toBeGreaterThanOrEqual(20);
    expect(topAnchors.length).toBeGreaterThanOrEqual(18);

    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: `Revenue ${quotedFigures[0] ?? ""}`, articleIndex: 1 },
          { text: `Growth ${quotedFigures[1] ?? ""}`, articleIndex: 1 },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { text: quotedFigures[2] ?? "Deal", articleIndex: 2 },
          { text: quotedFigures[3] ?? "Move", articleIndex: 3 },
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [{ text: quotedFigures[4] ?? "Policy", articleIndex: 4 }],
      },
      industryPulse: {
        displayHeading: "Pulse",
        prose: `Earnings ${quotedFigures[5] ?? "steady"}.`,
      },
    });

    const anchorsEnabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        numericAnchors: { enabled: true, perArticleCap: 5, totalCap: 25 },
      }),
    );

    // Act
    const result = await generateNewsletterWithLlm(
      anchorRichSources,
      anchorsEnabledConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.numericAnchorSummary).toBeDefined();
    expect(
      result.numericAnchorSummary?.anchorsExtracted,
    ).toBeGreaterThanOrEqual(20);
    expect(result.numericAnchorSummary?.anchorsTopSelected).toBe(
      topAnchors.length,
    );
    expect(result.numericAnchorSummary?.anchorsQuotedVerbatim).toBe(6);
    expect(result.numericAnchorSummary?.anchorCoverageRatio).toBeCloseTo(
      6 / topAnchors.length,
      2,
    );
    expect(result.resolvedUserPrompt).toContain(
      "VERBATIM FIGURES AVAILABLE FROM SOURCES",
    );
  });

  it("does not extract anchors or report coverage when disabled", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    const result = await generateNewsletterWithLlm(
      anchorRichSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.numericAnchorSummary).toBeUndefined();
    expect(result.resolvedUserPrompt).not.toContain(
      "VERBATIM FIGURES AVAILABLE FROM SOURCES",
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-run dedup (plan 48)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — cross-run dedup", () => {
  const recentBulletsFixture = Array.from({ length: 30 }, (_, index) => ({
    newsletterId: `nl-${String(index)}`,
    sectionKey: "quickHits",
    bulletText: `Prior briefing bullet ${String(index)} about sector trends`,
    createdAt: new Date(2026, 3, 30 - index).toISOString(),
  }));

  it("injects 15 recent bullets into the user prompt when enabled", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();
    const dedupEnabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        crossRunDedup: { enabled: true, windowDays: 14 },
      }),
    );

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      dedupEnabledConfig,
      { ...testContext, recentBullets: recentBulletsFixture },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.resolvedUserPrompt).toContain(
      "AVOID REPEATING THESE RECENT BULLETS",
    );
    const blockStart = result.resolvedUserPrompt.indexOf(
      "AVOID REPEATING THESE RECENT BULLETS",
    );
    const avoidanceLines = result.resolvedUserPrompt
      .slice(blockStart)
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(avoidanceLines).toHaveLength(15);
  });

  it("omits the avoidance block when cross-run dedup is disabled", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();
    const baseline = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Act
    const withHistory = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext, recentBullets: recentBulletsFixture },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(withHistory.resolvedUserPrompt).toBe(baseline.resolvedUserPrompt);
    expect(baseline.resolvedUserPrompt).not.toContain(
      "AVOID REPEATING THESE RECENT BULLETS",
    );
  });
});

// ---------------------------------------------------------------------------
// Style polish (plan 49)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — style polish", () => {
  it("keeps schema-valid structure and strips filler from shipped content when enabled", async () => {
    // Setup
    const structuredObject: IndustryNewsletterStructure = {
      ...minimalIndustryBrief(),
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            text: "It's worth noting that BCA grew profit by 12%",
            articleIndex: 1,
          },
          { text: "Peer spreads widened on retail funding.", articleIndex: 2 },
        ],
      },
    };
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: structuredObject,
    });
    const polishConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test" },
        sourceRanking: { enabled: false },
        polish: { enabled: true, tier: "safe" },
      }),
    );

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      polishConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    // Assert
    expect(result.polishSummary?.totalReplacements).toBeGreaterThan(0);
    expect(result.content).not.toContain("It's worth noting");
    expect(result.content).toContain("BCA grew profit by 12%");
    const polished = polishNewsletter(structuredObject, {
      tier: "safe",
      disabledRuleIds: [],
    });
    expect(() =>
      industryNewsletterStructureSchema.parse(polished.structure),
    ).not.toThrow();
    expect(polished.structure.competitiveLandscape.bullets[0]?.text).toBe(
      "BCA grew profit by 12%",
    );
  });
});
