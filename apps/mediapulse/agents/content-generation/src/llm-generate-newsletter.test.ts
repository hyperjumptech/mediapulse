import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@workspace/logger";

import { parseIndustryNewsletterWire } from "@workspace/email-templates/parse-industry-newsletter-wire";

import {
  ContentGenerationConfigSchema,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import {
  buildCompetitorPromptBlock,
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

/** Disables quality passes so unit tests isolate one pipeline stage. */
const conservativeTestConfigInput = {
  credentials: { openaiApiKey: "sk-test" },
  inputs: {
    sourceRanking: { enabled: false },
    fewShot: { enabled: false },
    numericAnchors: { enabled: false },
  },
  creativity: {
    brainstorm: { enabled: false },
  },
  quality: {
    citationGrounding: { enabled: false },
    polish: { enabled: false },
    crossRunDedup: { enabled: false },
    selfCritique: { enabled: false },
    requireCitation: { enabled: false },
  },
  delivery: {
    subjectLine: { enabled: false },
  },
} as const;

/** Minimal resolved config used across tests (ranking off — legacy prompt order). */
const baseConfig = resolveContentGenerationConfig(
  ContentGenerationConfigSchema.parse(conservativeTestConfigInput),
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
      { title: "T1", text: "B1", articleIndex: 1 },
      { title: "T2", text: "B2", articleIndex: 2 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ title: "T3", text: "D1", articleIndex: 3 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ title: "T4", text: "R1" }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Disruptors",
    prose: "Innovation forward.",
  },
  quickHits: {
    displayHeading: "Quick",
    items: [
      { title: "Q1", text: "h1", articleIndex: 1 },
      { title: "Q2", text: "h2", articleIndex: 2 },
      { title: "Q3", text: "h3", articleIndex: 3 },
      { title: "Q4", text: "h4", articleIndex: 1 },
      { title: "Q5", text: "h5", articleIndex: 2 },
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
        ...conservativeTestConfigInput,
        output: { topNewsCount: 2 },
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { title: "T1", text: "b1", articleIndex: 1 },
          { title: "T2", text: "b2", articleIndex: 2 },
        ],
      },
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ title: "T3", text: "d1", articleIndex: 1 }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "R",
        bullets: [{ title: "T4", text: "r1", articleIndex: 2 }],
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { title: "Q1", text: "h1", articleIndex: 1 },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 1 },
          { title: "Q4", text: "h4", articleIndex: 2 },
          { title: "Q5", text: "h5", articleIndex: 1 },
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
            title: "T1",
            text: "Big tech posted strong gains for the third consecutive day.",
            articleIndex: 1,
          },
          {
            title: "T2",
            text: "Federal Reserve held interest rates steady at its latest meeting.",
            articleIndex: 2,
          },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          {
            title: "T3",
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

  it("omits unsupported sampling fields from generateObjectFn", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn();

    // Act
    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
      sleepFn: noopSleepFn,
    });

    // Assert
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("temperature");
    expect(callArgs).not.toHaveProperty("topP");
    expect(callArgs).not.toHaveProperty("presencePenalty");
    expect(callArgs).not.toHaveProperty("frequencyPenalty");
  });

  it("passes timeout to generateObjectFn when openai.timeoutMs is set", async () => {
    // Setup
    const configWithTimeout = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        credentials: { openaiApiKey: "sk-test", timeoutMs: 5000 },
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
        ...conservativeTestConfigInput,
        reliability: {
          llmRetry: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
            jitter: false,
          },
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
        ...conservativeTestConfigInput,
        reliability: {
          llmRetry: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
            jitter: false,
          },
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

    expect(generateObjectFn).toHaveBeenCalledTimes(3);
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
            { title: "Q1", text: "a", articleIndex: 1 },
            { title: "Q2", text: "b", articleIndex: 2 },
            { title: "Q3", text: "c", articleIndex: 3 },
            { title: "Q4", text: "d", articleIndex: 1 },
            { title: "Q5", text: "e", articleIndex: 2 },
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
  it("substitutes {{date}} and sources in the default user prompt template", async () => {
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

    // Assert — the default template substitutes {{date}} and embeds sources
    expect(result.resolvedUserPrompt).toContain(testContext.date);
    expect(result.resolvedUserPrompt).toContain("Story A");
    const callArgs = (generateObjectFn as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as GenerateNewsletterObjectArgs;
    expect(callArgs.prompt).toBe(result.resolvedUserPrompt);
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
        ...conservativeTestConfigInput,
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
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          sourceRanking: { enabled: true, maxPerHost: 2 },
        },
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
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          fewShot: { enabled: false },
        },
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
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          fewShot: { enabled: true, maxExemplars: 1 },
        },
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
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          fewShot: { enabled: true, maxExemplars: 1, sectorTag: "industrial" },
        },
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
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          fewShot: { enabled: false },
        },
      }),
    );
    const enabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          fewShot: { enabled: true },
        },
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
      ...conservativeTestConfigInput,
      creativity: {
        brainstorm: { enabled: true },
      },
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
        ...conservativeTestConfigInput,
        creativity: {
          brainstorm: { enabled: false },
        },
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
        ...conservativeTestConfigInput,
        credentials: { openaiApiKey: "sk-test", timeoutMs: 1000 },
        creativity: {
          brainstorm: { enabled: true },
        },
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
            title: "T1",
            text: "Net interest margin reached 6.1% as deposit competition intensified (Article 1).",
            articleIndex: 1,
          },
          {
            title: "T2",
            text: "Peer spreads widened on retail funding.",
            articleIndex: 2,
          },
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
      title: `Q${String(index + 1)}`,
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
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          citationGrounding: {
            enabled: true,
            policy: "drop",
            minOverlapScore: 0.18,
          },
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
      ...conservativeTestConfigInput,
      credentials: { openaiApiKey: "sk-test", timeoutMs: 1000 },
      quality: {
        ...conservativeTestConfigInput.quality,
        selfCritique: {
          enabled: true,
          dropFraction: 0.2,
          minBulletCount: 8,
          preferRewriteOverDrop: true,
        },
      },
    }),
  );

  it("rewrites low-scored bullets in place when suggestedRewrite is provided", async () => {
    // Setup
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { title: "T1", text: "Weak one.", articleIndex: 1 },
          { title: "T2", text: "Weak two.", articleIndex: 1 },
          { title: "T3", text: "Weak three.", articleIndex: 1 },
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
          { title: "T1", text: "Weak one.", articleIndex: 1 },
          { title: "T2", text: "Weak two.", articleIndex: 1 },
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
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          selfCritique: {
            enabled: true,
            minBulletCount: 10,
          },
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

  it("ships un-critiqued bullets and logs self_critique_failed_fallback when the critique throws", async () => {
    // Setup — mirror the real failure where truncated JSON yields NoObjectGeneratedError
    const generateObjectFn = makeSuccessfulGenerateFn();
    const critiqueGenerateObjectFn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(
          Object.create(
            NoObjectGeneratedError.prototype,
          ) as NoObjectGeneratedError,
          { message: "No object generated", name: "AI_NoObjectGeneratedError" },
        ),
      );
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);

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

    // Assert — the run still produces a newsletter, critique is marked failed
    expect(critiqueGenerateObjectFn).toHaveBeenCalledOnce();
    expect(result.critiqueFailed).toBe(true);
    expect(result.critiqueSummary).toBeUndefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "self_critique_failed_fallback" }),
      expect.any(String),
    );
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
          {
            title: "T1",
            text: `Revenue ${quotedFigures[0] ?? ""}`,
            articleIndex: 1,
          },
          {
            title: "T2",
            text: `Growth ${quotedFigures[1] ?? ""}`,
            articleIndex: 1,
          },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { title: "T3", text: quotedFigures[2] ?? "Deal", articleIndex: 2 },
          { title: "T4", text: quotedFigures[3] ?? "Move", articleIndex: 3 },
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [
          { title: "T5", text: quotedFigures[4] ?? "Policy", articleIndex: 4 },
        ],
      },
      industryPulse: {
        displayHeading: "Pulse",
        prose: `Earnings ${quotedFigures[5] ?? "steady"}.`,
      },
    });

    const anchorsEnabledConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        inputs: {
          ...conservativeTestConfigInput.inputs,
          numericAnchors: { enabled: true, perArticleCap: 5, totalCap: 25 },
        },
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
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          crossRunDedup: { enabled: true, windowDays: 14 },
        },
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
            title: "T1",
            text: "It's worth noting that BCA grew profit by 12%",
            articleIndex: 1,
          },
          {
            title: "T2",
            text: "Peer spreads widened on retail funding.",
            articleIndex: 2,
          },
        ],
      },
    };
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: structuredObject,
    });
    const polishConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          polish: { enabled: true, tier: "safe" },
        },
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

// ---------------------------------------------------------------------------
// Best-quality default profile (plan 62)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — best-quality default profile", () => {
  it("runs brainstorm, structured, critique, and subject-line LLM calls with default config", async () => {
    // Setup
    const bestQualityConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        credentials: { openaiApiKey: "sk-test" },
      }),
    );
    const generateTextFn = vi.fn().mockResolvedValue({
      text: [
        "HEADLINE THESIS: Markets in focus",
        "WHAT CHANGED: Rates held steady",
      ].join("\n"),
      usage: { inputTokens: 10, outputTokens: 10 },
    });
    const generateObjectFn = makeSuccessfulGenerateFn();
    const critiqueGenerateObjectFn = vi.fn().mockResolvedValue({
      object: { ratings: [] },
      usage: { promptTokens: 5, completionTokens: 5 },
    });
    const subjectGenerateObjectFn = vi.fn().mockResolvedValue({
      object: {
        candidates: [
          { subject: "Alt headline A", style: "curiosity", preheader: "p1" },
          { subject: "Alt headline B", style: "straight", preheader: "p2" },
          { subject: "Alt headline C", style: "ticker", preheader: "p3" },
        ],
      },
      usage: { promptTokens: 8, completionTokens: 8 },
    });
    const recentBullets = [
      {
        newsletterId: "nl-1",
        sectionKey: "quickHits",
        bulletText: "Prior sector note from last week",
        createdAt: "2026-04-20T00:00:00.000Z",
      },
    ];

    // Act
    const result = await generateNewsletterWithLlm(
      testSources,
      bestQualityConfig,
      { ...testContext, recentBullets, runStartedAt: 0 },
      {
        generateObjectFn,
        generateTextFn,
        critiqueGenerateObjectFn,
        subjectGenerateObjectFn,
        sleepFn: noopSleepFn,
        nowFn: () => 100,
      },
    );

    // Assert — all quality passes enabled and exercised
    expect(bestQualityConfig.creativity.brainstorm.enabled).toBe(true);
    expect(bestQualityConfig.inputs.fewShot.enabled).toBe(true);
    expect(bestQualityConfig.quality.citationGrounding.enabled).toBe(true);
    expect(bestQualityConfig.inputs.numericAnchors.enabled).toBe(true);
    expect(bestQualityConfig.quality.selfCritique.enabled).toBe(true);
    expect(bestQualityConfig.delivery.subjectLine.enabled).toBe(true);
    expect(bestQualityConfig.quality.polish.enabled).toBe(true);
    expect(bestQualityConfig.quality.crossRunDedup.enabled).toBe(true);
    expect(generateTextFn).toHaveBeenCalledOnce();
    expect(generateObjectFn).toHaveBeenCalled();
    expect(critiqueGenerateObjectFn).toHaveBeenCalledOnce();
    expect(subjectGenerateObjectFn).toHaveBeenCalledOnce();
    expect(result.brainstormUsed).toBe(true);
    expect(result.resolvedUserPrompt).toContain("EXEMPLAR");
    expect(result.resolvedUserPrompt).toContain(
      "AVOID REPEATING THESE RECENT BULLETS",
    );
    expect(result.polishSummary).toBeDefined();
    expect(result.citationGroundingSummary).toBeDefined();
    expect(result.numericAnchorSummary).toBeDefined();
    expect(result.critiqueSummary).toBeDefined();
    expect(result.subjectLineSummary).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: require-citation pruning pass
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — require-citation pruning", () => {
  const requireCitationConfig = resolveContentGenerationConfig(
    ContentGenerationConfigSchema.parse({
      ...conservativeTestConfigInput,
      quality: {
        ...conservativeTestConfigInput.quality,
        requireCitation: { enabled: true },
      },
    }),
  );

  it("removes a section whose bullets are all uncited and keeps cited sections", async () => {
    // industry-pulse cites article 1 (resolves URL) — survives.
    // competitive-landscape has only uncited bullets (no articleIndex) — removed.
    // deals has one bullet with articleIndex 1 — survives.
    // regulatory-policy-watch has no citations — removed.
    // disruptors-or-tech uses bullets format with articleIndex 2 — survives.
    // quick-hits: one uncited (articleIndex 99), one duplicate (articleIndex 1 repeated).
    const generateObjectFn = makeSuccessfulGenerateFn({
      industryPulse: {
        displayHeading: "Pulse",
        prose: "Stocks rose for the third day.",
        articleIndex: 1,
      },
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { title: "T1", text: "Uncited A" },
          { title: "T2", text: "Uncited B" },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ title: "T3", text: "Cited deal", articleIndex: 1 }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [{ title: "T4", text: "Uncited regulatory" }],
      },
      disruptorsOrTech: {
        format: "bullets",
        displayHeading: "Disruptors",
        bullets: [
          { title: "T5", text: "Innovation forward.", articleIndex: 2 },
        ],
      },
      quickHits: {
        displayHeading: "Quick Hits",
        items: [
          { title: "Q1", text: "Hit with source", articleIndex: 1 },
          { title: "Q2", text: "Hit with source 2", articleIndex: 2 },
          { title: "Q3", text: "Hit with source 3", articleIndex: 3 },
          { title: "Q4", text: "Hit uncited", articleIndex: 99 },
          { title: "Q5", text: "Hit duplicate", articleIndex: 1 },
        ],
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      requireCitationConfig,
      { tickerId: "TEST", date: "2024-01-01" },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    const parsed = parseIndustryNewsletterWire(result.content);

    const keys = parsed?.sections.map((s) => s.machineKey) ?? [];
    expect(keys).toContain("industry-pulse");
    expect(keys).not.toContain("competitive-landscape");
    expect(keys).toContain("deals-and-movements");
    expect(keys).not.toContain("regulatory-policy-watch");
    expect(keys).toContain("disruptors-or-tech");
    expect(keys).toContain("quick-hits");

    expect(result.requireCitationSummary).toBeDefined();
    expect(result.requireCitationSummary?.sectionsRemoved).toBe(2);
    expect(
      result.requireCitationSummary?.bulletsRemovedUncited,
    ).toBeGreaterThan(0);
    expect(result.requireCitationSummary?.bulletsRemovedDuplicate).toBe(3);
  });

  it("passes content through unchanged when requireCitation is disabled", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ title: "T1", text: "Uncited" }],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ title: "T2", text: "Uncited" }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [{ title: "T3", text: "Uncited" }],
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { tickerId: "TEST", date: "2024-01-01" },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.requireCitationSummary).toBeUndefined();
    // All sections remain since pruning is off
    const parsed = parseIndustryNewsletterWire(result.content);
    const keys = parsed?.sections.map((s) => s.machineKey) ?? [];
    expect(keys).toContain("competitive-landscape");
    expect(keys).toContain("deals-and-movements");
    expect(keys).toContain("regulatory-policy-watch");
  });
});

// ---------------------------------------------------------------------------
// Section fill snapshot
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — sectionFillSnapshot", () => {
  it("sectionFillSnapshot.bySection has an entry for every section", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.sectionFillSnapshot).toBeDefined();
    for (const sectionId of [
      "industryPulse",
      "competitiveLandscape",
      "dealsAndMovements",
      "regulatoryPolicyWatch",
      "disruptorsOrTech",
      "quickHits",
    ]) {
      expect(result.sectionFillSnapshot!.bySection).toHaveProperty(sectionId);
    }
  });

  it("sectionFillSnapshot.sectionsRemoved is empty when requireCitation is disabled", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();
    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.sectionFillSnapshot!.sectionsRemoved).toEqual([]);
  });

  it("sectionFillSnapshot.sectionsRemoved lists sections pruned by require-citation", async () => {
    const requireCitationConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          requireCitation: { enabled: true },
        },
      }),
    );

    const generateObjectFn = makeSuccessfulGenerateFn({
      industryPulse: {
        displayHeading: "Pulse",
        prose: "Market update.",
        articleIndex: 1,
      },
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { title: "T1", text: "Uncited A" },
          { title: "T2", text: "Uncited B" },
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [{ title: "T3", text: "Uncited regulatory" }],
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      requireCitationConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    const { sectionsRemoved, bySection } = result.sectionFillSnapshot!;
    expect(sectionsRemoved).toContain("competitiveLandscape");
    expect(sectionsRemoved).toContain("regulatoryPolicyWatch");
    expect(bySection.competitiveLandscape.citedBullets).toBe(0);
    expect(bySection.regulatoryPolicyWatch.citedBullets).toBe(0);
  });

  it("citedBullets counts bullets in each section of the final newsletter", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn({
      competitiveLandscape: {
        displayHeading: "Comp",
        bullets: [
          { title: "T1", text: "B1", articleIndex: 1 },
          { title: "T2", text: "B2", articleIndex: 2 },
          { title: "T3", text: "B3", articleIndex: 3 },
        ],
      },
      quickHits: {
        displayHeading: "Quick",
        items: [
          { title: "Q1", text: "h1", articleIndex: 1 },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 3 },
          { title: "Q4", text: "h4", articleIndex: 1 },
          { title: "Q5", text: "h5", articleIndex: 2 },
          { title: "Q6", text: "h6", articleIndex: 3 },
        ],
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(
      result.sectionFillSnapshot!.bySection.competitiveLandscape.citedBullets,
    ).toBe(3);
    expect(result.sectionFillSnapshot!.bySection.quickHits.citedBullets).toBe(
      6,
    );
    expect(
      result.sectionFillSnapshot!.bySection.industryPulse.citedBullets,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Competitor-anchored prompt injection
// ---------------------------------------------------------------------------

describe("buildCompetitorPromptBlock", () => {
  it("returns empty string when competitors list is empty", () => {
    expect(buildCompetitorPromptBlock([], "Bank Central Asia")).toBe("");
  });

  it("names competitors and issuer in the directive text", () => {
    const block = buildCompetitorPromptBlock(
      [
        { name: "Bank Mandiri", relation: "COMPETITOR" },
        { name: "Bank BRI", relation: "SECTOR_PEER" },
      ],
      "Bank Central Asia",
    );
    expect(block).toContain("Bank Mandiri");
    expect(block).toContain("Bank BRI");
    expect(block).toContain("Bank Central Asia");
    expect(block).toContain(
      "Do NOT make these bullets about Bank Central Asia",
    );
  });
});

describe("generateNewsletterWithLlm — competitor prompt injection", () => {
  it("injects competitor directive into the resolved user prompt when competitors are provided", async () => {
    let capturedPrompt = "";
    const generateObjectFn: GenerateNewsletterObjectFn = vi
      .fn()
      .mockImplementation(async (args: GenerateNewsletterObjectArgs) => {
        capturedPrompt = args.prompt;
        return { object: minimalIndustryBrief() };
      });

    const competitorConfig = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        ...conservativeTestConfigInput,
        quality: {
          ...conservativeTestConfigInput.quality,
          competitiveFocus: { enabled: true, policy: "drop" },
        },
      }),
    );

    await generateNewsletterWithLlm(
      testSources,
      competitorConfig,
      {
        ...testContext,
        tickerName: "Bank Central Asia",
        competitors: [
          { name: "Bank Mandiri", relation: "COMPETITOR" },
          { name: "Bank BRI", relation: "SECTOR_PEER" },
        ],
        issuerAliases: ["Bank Central Asia", "BCA", "BBCA"],
      },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(capturedPrompt).toContain("Bank Mandiri");
    expect(capturedPrompt).toContain("Bank BRI");
    expect(capturedPrompt).toContain(
      "Do NOT make these bullets about Bank Central Asia",
    );
  });

  it("does not inject any directive or broken placeholder when no competitors are provided", async () => {
    let capturedPrompt = "";
    const generateObjectFn: GenerateNewsletterObjectFn = vi
      .fn()
      .mockImplementation(async (args: GenerateNewsletterObjectArgs) => {
        capturedPrompt = args.prompt;
        return { object: minimalIndustryBrief() };
      });

    await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      {
        ...testContext,
        tickerName: "Bank Central Asia",
        competitors: [],
        issuerAliases: ["Bank Central Asia", "BCA"],
      },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(capturedPrompt).not.toContain("Do NOT make these bullets about");
    expect(capturedPrompt).not.toContain("{{");
  });
});

describe("generateNewsletterWithLlm — contract brief", () => {
  it("system prompt does not contain product_contract block when brief is absent (reversibility guarantee)", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );

    expect(result.systemPrompt).not.toContain("<product_contract>");
  });

  it("system prompt contains product_contract block when brief is present", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext, brief: "Daily newsletter for executives." },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.systemPrompt).toContain("<product_contract>");
    expect(result.systemPrompt).toContain("Daily newsletter for executives.");
  });

  it("returned systemPrompt differs when brief is present so computePromptHash sees the full prompt", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const withoutBrief = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      {
        generateObjectFn,
        sleepFn: noopSleepFn,
      },
    );
    const withBrief = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext, brief: "Some brief." },
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(withBrief.systemPrompt).toContain("<product_contract>");
    expect(withBrief.systemPrompt).not.toBe(withoutBrief.systemPrompt);
  });
});
