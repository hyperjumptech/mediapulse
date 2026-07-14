import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseIndustryNewsletterWire } from "@workspace/email-templates/parse-industry-newsletter-wire";

import {
  CONTENT_GENERATION_CONSTANTS,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import {
  buildAvoidRecentBulletsBlock,
  buildCompetitorPromptBlock,
  collectNewsletterCitations,
  generateNewsletterWithLlm,
  groupSourcesBySection,
  SYSTEM_PROMPT,
  type GenerateNewsletterObjectFn,
} from "./llm-generate-newsletter.js";
import type { IndustryNewsletterResolved } from "./industry-newsletter-urls.js";
import type { IndustryNewsletterStructure } from "./industry-newsletter-schema.js";
import type { SourceForGeneration } from "./types.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig = resolveContentGenerationConfig({
  model: { apiKey: "sk-test", model: "gpt-4o", baseUrl: "https://example.com" },
});

const noopSleepFn = vi.fn().mockResolvedValue(undefined);

/** Minimal valid industry briefing object returned by the mocked LLM. */
const minimalIndustryBrief = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Market Rally Continues",
  industryPulse: {
    displayHeading: "Pulse",
    prose: "Stocks rose for the third day.",
    articleIndex: 1,
  },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { title: "T1", text: "Rival A expanded its branches.", articleIndex: 1 },
      { title: "T2", text: "Rival B cut its fees.", articleIndex: 2 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ title: "T3", text: "A merger closed.", articleIndex: 3 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ title: "T4", text: "New rules took effect.", articleIndex: 1 }],
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

function makeSuccessfulGenerateFn(
  patch: Partial<IndustryNewsletterStructure> = {},
): GenerateNewsletterObjectFn {
  return vi.fn().mockResolvedValue({
    object: { ...minimalIndustryBrief(), ...patch },
  });
}

const testSources: SourceForGeneration[] = [
  {
    url: "https://example.com/a",
    title: "Story A",
    content: "Content A.",
    section: "quickHits",
  },
  {
    url: "https://example.com/b",
    title: "Story B",
    content: "Content B.",
    section: "competitiveLandscape",
  },
  {
    url: "https://example.com/c",
    title: "Story C",
    content: "Content C.",
    section: "dealsAndMovements",
  },
];

const testContext = {
  tickerId: "ticker-123",
  date: "2026-04-21",
  tickerSymbol: "BBCA",
  tickerName: "Bank Central Asia",
};

// ---------------------------------------------------------------------------
// groupSourcesBySection
// ---------------------------------------------------------------------------

describe("collectNewsletterCitations", () => {
  const citationSources: SourceForGeneration[] = [
    {
      dataSourceId: "ds-a",
      url: "https://example.com/a",
      title: "Story A",
      content: "Content A.",
    },
    {
      dataSourceId: "ds-b",
      url: "https://example.com/b",
      title: "Story B",
      content: "Content B.",
    },
  ];

  it("maps cited bullet urls back to their data source ids per section", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: {
        displayHeading: "Pulse",
        prose: "Lead.",
        url: "https://example.com/a",
      },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [{ title: "T", text: "t", url: "https://example.com/b" }],
      },
      quickHits: {
        displayHeading: "Q",
        items: [{ title: "Q1", text: "q", url: "https://example.com/a" }],
      },
    };

    const citations = collectNewsletterCitations(resolved, citationSources);

    expect(citations).toEqual([
      { dataSourceId: "ds-a", sectionKey: "industryPulse" },
      { dataSourceId: "ds-b", sectionKey: "competitiveLandscape" },
      { dataSourceId: "ds-a", sectionKey: "quickHits" },
    ]);
  });

  it("de-dupes repeats within a section and skips unlinked or unknown urls", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [
          { title: "T1", text: "t1", url: "https://example.com/a" },
          { title: "T2", text: "t2", url: "https://example.com/a" },
          { title: "T3", text: "t3" },
          { title: "T4", text: "t4", url: "https://example.com/unknown" },
        ],
      },
    };

    const citations = collectNewsletterCitations(resolved, citationSources);

    expect(citations).toEqual([
      { dataSourceId: "ds-a", sectionKey: "dealsAndMovements" },
    ]);
  });
});

describe("groupSourcesBySection", () => {
  it("orders sources by their upstream section, stably within a section", () => {
    const sources: SourceForGeneration[] = [
      { url: "u1", title: "deal", content: "c", section: "dealsAndMovements" },
      { url: "u2", title: "pulse", content: "c", section: "industryPulse" },
      { url: "u3", title: "deal2", content: "c", section: "dealsAndMovements" },
      { url: "u4", title: "quick", content: "c", section: "quickHits" },
    ];

    const grouped = groupSourcesBySection(sources);

    expect(grouped.map((s) => s.title)).toEqual([
      "pulse",
      "deal",
      "deal2",
      "quick",
    ]);
  });

  it("places sources without a section last", () => {
    const sources: SourceForGeneration[] = [
      { url: "u1", title: "none", content: "c" },
      { url: "u2", title: "pulse", content: "c", section: "industryPulse" },
    ];

    const grouped = groupSourcesBySection(sources);

    expect(grouped.map((s) => s.title)).toEqual(["pulse", "none"]);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — happy path", () => {
  it("returns subject, content body, and description on success", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    expect(result.subject).toContain("Market Rally Continues");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.description).toBe("Stocks rose for the third day.");
  });

  it("prepends the ticker symbol prefix to the subject", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    expect(result.subject).toContain("BBCA");
  });

  it("slices sources to the hardcoded topNewsCount when building the prompt", async () => {
    const manySources: SourceForGeneration[] = Array.from(
      { length: CONTENT_GENERATION_CONSTANTS.topNewsCount + 5 },
      (_, index) => ({
        url: `https://example.com/${String(index)}`,
        title: `Story ${String(index)}`,
        content: `Content ${String(index)}.`,
        section: "quickHits",
      }),
    );
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      manySources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    // topNewsCount articles max appear in the resolved prompt.
    const articleMatches = result.resolvedUserPrompt.match(/Article \d+:/g);
    expect(articleMatches?.length).toBe(
      CONTENT_GENERATION_CONSTANTS.topNewsCount,
    );
  });

  it("passes the hardcoded request timeout and maxRetries 0 to generateObjectFn", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: minimalIndustryBrief(),
    });

    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
    });

    const args = generateObjectFn.mock.calls[0]![0];
    expect(args.maxRetries).toBe(0);
    expect(args.timeout).toBe(CONTENT_GENERATION_CONSTANTS.requestTimeoutMs);
  });
});

// ---------------------------------------------------------------------------
// Non-retryable errors
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — non-retryable errors", () => {
  it("throws TypeValidationError immediately without retrying", async () => {
    const error = new TypeValidationError({
      value: {},
      cause: new Error("bad"),
    });
    const generateObjectFn = vi.fn().mockRejectedValue(error);

    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toBeInstanceOf(TypeValidationError);
    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });

  it("throws APICallError (401) immediately without retrying", async () => {
    const error = new APICallError({
      message: "Unauthorized",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });
    const generateObjectFn = vi.fn().mockRejectedValue(error);

    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toBeInstanceOf(APICallError);
    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });

  it("throws NoObjectGeneratedError immediately without retrying", async () => {
    const error = Object.assign(
      Object.create(NoObjectGeneratedError.prototype) as NoObjectGeneratedError,
      { message: "No object generated", name: "AI_NoObjectGeneratedError" },
    );
    const generateObjectFn = vi.fn().mockRejectedValue(error);

    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toBeInstanceOf(NoObjectGeneratedError);
    expect(generateObjectFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retryable errors
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — retryable errors", () => {
  it("retries up to maxAttempts on a 429 rate-limit error", async () => {
    const error = new APICallError({
      message: "Too Many Requests",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const generateObjectFn = vi.fn().mockRejectedValue(error);

    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toBeInstanceOf(APICallError);
    expect(generateObjectFn).toHaveBeenCalledTimes(
      CONTENT_GENERATION_CONSTANTS.retry.maxAttempts,
    );
  });

  it("succeeds after a transient 500 failure", async () => {
    const error = new APICallError({
      message: "Server Error",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
    });
    const generateObjectFn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ object: minimalIndustryBrief() });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content.length).toBeGreaterThan(0);
    expect(generateObjectFn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Token usage and provenance
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — token usage and provenance", () => {
  it("returns token counts when usage is present", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: minimalIndustryBrief(),
      usage: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(40);
    expect(result.totalTokens).toBe(140);
  });

  it("returns null for token fields when usage is absent", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: minimalIndustryBrief(),
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.promptTokens).toBeNull();
    expect(result.completionTokens).toBeNull();
    expect(result.totalTokens).toBeNull();
  });

  it("returns a non-empty systemPrompt and a resolvedUserPrompt containing source content", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.systemPrompt.length).toBeGreaterThan(0);
    expect(result.resolvedUserPrompt).toContain("Content A.");
  });

  it("returns different resolvedUserPrompt for different sources", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const resultA = await generateNewsletterWithLlm(
      [{ url: "https://x/a", title: "A", content: "Alpha." }],
      baseConfig,
      testContext,
      { generateObjectFn },
    );
    const resultB = await generateNewsletterWithLlm(
      [{ url: "https://x/b", title: "B", content: "Beta." }],
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(resultA.resolvedUserPrompt).not.toBe(resultB.resolvedUserPrompt);
  });
});

// ---------------------------------------------------------------------------
// Prompt wiring and substitution
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — prompt wiring", () => {
  it("substitutes {{date}} and presents sources as numbered articles", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.resolvedUserPrompt).toContain("2026-04-21");
    expect(result.resolvedUserPrompt).toContain("Article 1:");
  });

  it("includes the authoritative assigned-section line for each article", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.resolvedUserPrompt).toContain("Assigned section:");
  });
});

// ---------------------------------------------------------------------------
// Citation grounding (always on)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — citation grounding", () => {
  it("returns a citation grounding summary", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.citationGroundingSummary).toBeDefined();
    expect(result.citationGroundingReports).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Require-citation pruning (always on)
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — require-citation pruning", () => {
  it("returns a require-citation summary", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.requireCitationSummary).toBeDefined();
  });

  it("keeps cited rows in the rendered newsletter wire", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    const parsed = parseIndustryNewsletterWire(result.content);
    expect(parsed).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sectionFillSnapshot
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — sectionFillSnapshot", () => {
  it("has an entry for every section", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    const sections = Object.keys(result.sectionFillSnapshot?.bySection ?? {});
    expect(sections).toEqual(
      expect.arrayContaining([
        "industryPulse",
        "competitiveLandscape",
        "dealsAndMovements",
        "regulatoryPolicyWatch",
        "disruptorsOrTech",
        "quickHits",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// buildCompetitorPromptBlock + competitor injection
// ---------------------------------------------------------------------------

describe("buildCompetitorPromptBlock", () => {
  it("returns empty string when competitors list is empty", () => {
    expect(buildCompetitorPromptBlock([], "Acme")).toBe("");
  });

  it("names competitors and issuer in the directive text", () => {
    const block = buildCompetitorPromptBlock(
      [
        { name: "Rival One", relation: "competitor" },
        { name: "Rival Two", relation: "competitor" },
      ],
      "Acme",
    );

    expect(block).toContain("Rival One");
    expect(block).toContain("Rival Two");
    expect(block).toContain("Acme");
  });
});

describe("generateNewsletterWithLlm — competitor prompt injection", () => {
  it("injects competitor directive into the resolved user prompt when competitors are provided", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      {
        ...testContext,
        competitors: [{ name: "Rival One", relation: "competitor" }],
      },
      { generateObjectFn },
    );

    expect(result.resolvedUserPrompt).toContain("Rival One");
  });

  it("does not inject any directive when no competitors are provided", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    expect(result.resolvedUserPrompt).not.toContain(
      "Competitive Landscape must focus",
    );
  });
});

// ---------------------------------------------------------------------------
// Contract brief
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — contract brief", () => {
  it("system prompt does not contain product_contract block when brief is absent", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    expect(result.systemPrompt).not.toContain("product_contract");
  });

  it("system prompt differs when a brief is present", async () => {
    const generateObjectFn = makeSuccessfulGenerateFn();

    const withoutBrief = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );
    const withBrief = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      {
        ...testContext,
        brief: "Focus on Indonesian banking sector dynamics.",
      },
      { generateObjectFn },
    );

    expect(withBrief.systemPrompt).not.toBe(withoutBrief.systemPrompt);
  });
});

// ---------------------------------------------------------------------------
// buildAvoidRecentBulletsBlock
// ---------------------------------------------------------------------------

describe("buildAvoidRecentBulletsBlock", () => {
  it("returns an empty string with no recent bullets or a non-positive limit", () => {
    expect(buildAvoidRecentBulletsBlock([], 20)).toBe("");
    expect(buildAvoidRecentBulletsBlock([{ bulletText: "Something" }], 0)).toBe(
      "",
    );
  });

  it("lists the recent bullets under an avoidance directive, capped at the limit", () => {
    const block = buildAvoidRecentBulletsBlock(
      [
        { bulletText: "First recent point" },
        { bulletText: "Second recent point" },
        { bulletText: "Third recent point" },
      ],
      2,
    );

    expect(block).toContain("AVOID REPEATING");
    expect(block).toContain("First recent point");
    expect(block).toContain("Second recent point");
    expect(block).not.toContain("Third recent point");
  });
});

// ---------------------------------------------------------------------------
// Cross-day dedup integration
// ---------------------------------------------------------------------------

const DUP_TEXT =
  "Acme Bank acquires rival fintech startup for five hundred million dollars";
const NOVEL_TEXT =
  "Regulator publishes fresh capital adequacy guidance for digital lenders";

const crossRunSources: SourceForGeneration[] = [
  {
    url: "https://example.com/dup",
    title: "Dup",
    content: DUP_TEXT,
    section: "competitiveLandscape",
  },
  {
    url: "https://example.com/novel",
    title: "Novel",
    content: NOVEL_TEXT,
    section: "competitiveLandscape",
  },
];

const crossRunGenerateFn = (): GenerateNewsletterObjectFn =>
  makeSuccessfulGenerateFn({
    competitiveLandscape: {
      displayHeading: "Competitive",
      bullets: [
        { title: "Dup", text: DUP_TEXT, articleIndex: 1 },
        { title: "Novel", text: NOVEL_TEXT, articleIndex: 2 },
      ],
    },
  });

describe("generateNewsletterWithLlm — cross-day dedup", () => {
  it("injects the avoidance block and drops a bullet repeating a recent one", async () => {
    const result = await generateNewsletterWithLlm(
      crossRunSources,
      baseConfig,
      {
        ...testContext,
        recentBullets: [
          { sectionKey: "competitiveLandscape", bulletText: DUP_TEXT },
        ],
      },
      { generateObjectFn: crossRunGenerateFn() },
    );

    // Prompt-level avoidance directive is present.
    expect(result.resolvedUserPrompt).toContain("AVOID REPEATING");
    expect(result.resolvedUserPrompt).toContain(DUP_TEXT);

    // Post-generation drop removed the repeated bullet, kept the novel one.
    expect(result.crossRunDedupSummary?.removedCount).toBe(1);
    expect(result.crossRunDedupSummary?.bySection.competitiveLandscape).toBe(1);
    expect(result.content).toContain(NOVEL_TEXT);
    expect(result.content).not.toContain(DUP_TEXT);
  });

  it("does not inject the block or run the drop when no recent bullets are provided", async () => {
    const result = await generateNewsletterWithLlm(
      crossRunSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn: crossRunGenerateFn() },
    );

    expect(result.resolvedUserPrompt).not.toContain("AVOID REPEATING");
    expect(result.crossRunDedupSummary).toBeUndefined();
    expect(result.content).toContain(DUP_TEXT);
  });
});

describe("SYSTEM_PROMPT — lead attribution fidelity", () => {
  it("binds the Industry Pulse lead to its single cited article", () => {
    expect(SYSTEM_PROMPT).toContain("Industry Pulse lead");
  });

  it("forbids attributing a cause or driver the cited article does not state", () => {
    expect(SYSTEM_PROMPT).toContain("do not attribute a cause or driver");
  });
});
