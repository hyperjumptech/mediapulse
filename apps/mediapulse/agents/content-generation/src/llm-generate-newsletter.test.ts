import { APICallError, TypeValidationError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";
import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";

import {
  CONTENT_GENERATION_CONSTANTS,
  resolveContentGenerationConfig,
} from "./config-schema.js";
import {
  backfillFailedSections,
  collectNewsletterCitations,
  collectNewsletterSections,
  countSummaryFailureReasons,
  generateNewsletterWithLlm,
  groupSourcesBySection,
  SUMMARIZER_CONCURRENCY,
  SUMMARY_FAILURE_REASONS,
  type GenerateNewsletterObjectArgs,
  type GenerateNewsletterObjectFn,
  type GenerateNewsletterObjectResult,
} from "./llm-generate-newsletter.js";
import type { SelectedArticle } from "./select-articles.js";
import { SUMMARIZE_ARTICLE_SYSTEM_PROMPT } from "./summarize-article.js";
import {
  MAX_SUBJECT_LENGTH,
  newsletterSubjectSchema,
} from "./write-subject.js";
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

const GENERATED_SUBJECT = "Regional lenders close a merger";

const isSubjectCall = (args: GenerateNewsletterObjectArgs): boolean =>
  args.schema === newsletterSubjectSchema;

/** Reads back the article title the summarizer prompt was built from. */
const promptTitle = (prompt: string): string =>
  (prompt.split("\n")[0] ?? "").replace("Title: ", "");

type FakeUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

/**
 * Builds a `generateObject` double that answers summarizer calls with one point naming the
 * article it was given, and the subject call with a fixed subject.
 */
const makeGenerateFn = (
  options: {
    usage?: FakeUsage;
    onSummarize?: (
      args: GenerateNewsletterObjectArgs,
    ) => Promise<GenerateNewsletterObjectResult>;
    onSubject?: (
      args: GenerateNewsletterObjectArgs,
    ) => Promise<GenerateNewsletterObjectResult>;
  } = {},
): GenerateNewsletterObjectFn =>
  vi.fn(async (args: GenerateNewsletterObjectArgs) => {
    if (isSubjectCall(args)) {
      if (options.onSubject !== undefined) {
        return options.onSubject(args);
      }

      return {
        object: { subject: GENERATED_SUBJECT },
        ...(options.usage !== undefined ? { usage: options.usage } : {}),
      };
    }
    if (options.onSummarize !== undefined) {
      return options.onSummarize(args);
    }

    return {
      object: {
        title: promptTitle(args.prompt),
        points: [`Key fact from ${promptTitle(args.prompt)}`],
      },
      ...(options.usage !== undefined ? { usage: options.usage } : {}),
    };
  });

const testSources: SourceForGeneration[] = [
  {
    dataSourceId: "ds-a",
    url: "https://example.com/a",
    title: "Nickel shipments rise",
    content: "Nickel ore shipments rose across Sulawesi smelters last quarter.",
    section: "quickHits",
    sectionScore: 0.9,
  },
  {
    dataSourceId: "ds-b",
    url: "https://example.com/b",
    title: "Rival A expands",
    content: "Rival A expanded its branches across eastern Indonesia.",
    author: "Jane Reporter",
    source: "Example Wire",
    section: "competitiveLandscape",
    sectionScore: 0.8,
  },
  {
    dataSourceId: "ds-c",
    url: "https://example.com/c",
    title: "Merger closes",
    content: "A merger between two regional lenders closed on Friday morning.",
    section: "dealsAndMovements",
    sectionScore: 0.7,
  },
];

const testContext = {
  tickerId: "ticker-123",
  date: "2026-04-21",
  tickerSymbol: "BBCA",
  tickerName: "Bank Central Asia",
};

// ---------------------------------------------------------------------------
// collectNewsletterCitations
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

  it("maps cited article urls back to their data source ids per section", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            { title: "Lead", url: "https://example.com/a", points: ["Lead."] },
          ],
        },
        {
          key: "competitive-landscape",
          articles: [
            { title: "T", url: "https://example.com/b", points: ["t"] },
          ],
        },
        {
          key: "quick-hits",
          articles: [
            { title: "Q1", url: "https://example.com/a", points: ["q"] },
          ],
        },
      ],
    };

    const citations = collectNewsletterCitations(document, citationSources);

    expect(citations).toEqual([
      { dataSourceId: "ds-a", sectionKey: "industryPulse" },
      { dataSourceId: "ds-b", sectionKey: "competitiveLandscape" },
      { dataSourceId: "ds-a", sectionKey: "quickHits" },
    ]);
  });

  it("de-dupes repeats within a section and skips unknown urls", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "deals-and-movements",
          articles: [
            { title: "T1", url: "https://example.com/a", points: ["t1"] },
            { title: "T2", url: "https://example.com/a", points: ["t2"] },
            { title: "T4", url: "https://example.com/unknown", points: ["t4"] },
          ],
        },
      ],
    };

    const citations = collectNewsletterCitations(document, citationSources);

    expect(citations).toEqual([
      { dataSourceId: "ds-a", sectionKey: "dealsAndMovements" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// collectNewsletterSections
// ---------------------------------------------------------------------------

describe("collectNewsletterSections", () => {
  const sectionSources: SourceForGeneration[] = [
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

  it("builds sections in document order with canonical headings and linked items", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "The lead story",
              url: "https://example.com/a",
              points: ["The lead prose."],
            },
          ],
        },
        {
          key: "deals-and-movements",
          articles: [
            {
              title: "Deal one",
              url: "https://example.com/b",
              points: ["Body one.", "Body two."],
            },
            {
              title: "Deal two",
              url: "https://example.com/unknown",
              points: ["Body three."],
            },
          ],
        },
      ],
    };

    const sections = collectNewsletterSections(document, sectionSources);

    expect(sections).toEqual([
      {
        sectionKey: "industryPulse",
        heading: "Industry Pulse",
        summary: null,
        position: 0,
        items: [
          {
            title: "The lead story",
            points: ["The lead prose."],
            url: "https://example.com/a",
            dataSourceId: "ds-a",
            position: 0,
          },
        ],
      },
      {
        sectionKey: "dealsAndMovements",
        heading: "Deals & Movements",
        summary: null,
        position: 1,
        items: [
          {
            title: "Deal one",
            points: ["Body one.", "Body two."],
            url: "https://example.com/b",
            dataSourceId: "ds-b",
            position: 0,
          },
          {
            title: "Deal two",
            points: ["Body three."],
            url: "https://example.com/unknown",
            dataSourceId: null,
            position: 1,
          },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// groupSourcesBySection
// ---------------------------------------------------------------------------

describe("groupSourcesBySection", () => {
  it("orders sources by their upstream section, stably within a section", () => {
    const sources: SourceForGeneration[] = [
      { url: "u1", title: "deal", content: "c", section: "dealsAndMovements" },
      { url: "u2", title: "pulse", content: "c", section: "industryPulse" },
      { url: "u3", title: "deal2", content: "c", section: "dealsAndMovements" },
      { url: "u4", title: "quick", content: "c", section: "quickHits" },
    ];

    const grouped = groupSourcesBySection(sources);

    expect(grouped.map((entry) => entry.title)).toEqual([
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

    expect(grouped.map((entry) => entry.title)).toEqual(["pulse", "none"]);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — happy path", () => {
  it("returns a subject and a valid JSON document in canonical section order", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );
    const parsed = readNewsletterDocument(result.content);

    expect(parsed).toBeDefined();
    expect(parsed?.sections.map((section) => section.key)).toEqual([
      "competitive-landscape",
      "deals-and-movements",
      "quick-hits",
    ]);
    expect(result.subject).toContain(GENERATED_SUBJECT);
  });

  it("prepends the ticker symbol prefix to the subject", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.subject.startsWith("BBCA")).toBe(true);
  });

  it("takes url, author, and source from the source row and title plus points from the model", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );
    const parsed = readNewsletterDocument(result.content);
    const competitive = parsed?.sections.find(
      (section) => section.key === "competitive-landscape",
    );

    expect(competitive?.articles[0]).toEqual({
      title: "Rival A expands",
      url: "https://example.com/b",
      author: "Jane Reporter",
      source: "Example Wire",
      points: ["Key fact from Rival A expands"],
    });
  });

  it("uses the model's translated title, not the raw source title", async () => {
    const generateObjectFn = makeGenerateFn({
      onSummarize: (args) => {
        const sourceTitle = promptTitle(args.prompt);
        const translated =
          sourceTitle === "Merger closes"
            ? "Regional lenders finalize merger"
            : sourceTitle;

        return Promise.resolve({
          object: {
            title: translated,
            points: [`Key fact from ${sourceTitle}`],
          },
        });
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );
    const parsed = readNewsletterDocument(result.content);
    const deals = parsed?.sections.find(
      (section) => section.key === "deals-and-movements",
    );

    expect(deals?.articles[0]?.title).toBe("Regional lenders finalize merger");
  });

  it("issues one summarizer call per selected article plus one subject call", async () => {
    const generateObjectFn = makeGenerateFn();

    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
    });
    const calls = vi.mocked(generateObjectFn).mock.calls;
    const summarizerCalls = calls.filter(([args]) => !isSubjectCall(args));
    const subjectCalls = calls.filter(([args]) => isSubjectCall(args));

    expect(summarizerCalls).toHaveLength(testSources.length);
    expect(subjectCalls).toHaveLength(1);
  });

  it("sends the summarizer system prompt, maxRetries 0, and the request timeout", async () => {
    const generateObjectFn = makeGenerateFn();

    await generateNewsletterWithLlm(testSources, baseConfig, testContext, {
      generateObjectFn,
    });
    const [summarizerArgs] = vi
      .mocked(generateObjectFn)
      .mock.calls.map(([args]) => args)
      .filter((args) => !isSubjectCall(args));

    expect(summarizerArgs?.system).toBe(SUMMARIZE_ARTICLE_SYSTEM_PROMPT);
    expect(summarizerArgs?.maxRetries).toBe(0);
    expect(summarizerArgs?.timeout).toBe(
      CONTENT_GENERATION_CONSTANTS.requestTimeoutMs,
    );
  });
});

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — summarizer concurrency", () => {
  it("never runs more than SUMMARIZER_CONCURRENCY summarizer calls at once", async () => {
    const manySources: SourceForGeneration[] = Array.from(
      { length: 12 },
      (_unused, index) => ({
        dataSourceId: `ds-${String(index)}`,
        url: `https://example.com/${String(index)}`,
        title: `Story ${String(index)}`,
        content: `Body for story ${String(index)}.`,
        section:
          index % 4 === 0
            ? "industryPulse"
            : index % 4 === 1
              ? "competitiveLandscape"
              : index % 4 === 2
                ? "dealsAndMovements"
                : "quickHits",
        sectionScore: 1 - index / 100,
      }),
    );

    let inFlight = 0;
    let peakInFlight = 0;
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    await generateNewsletterWithLlm(manySources, baseConfig, testContext, {
      generateObjectFn,
    });

    expect(peakInFlight).toBeGreaterThan(0);
    expect(peakInFlight).toBeLessThanOrEqual(SUMMARIZER_CONCURRENCY);
  });
});

// ---------------------------------------------------------------------------
// Per-article failure isolation
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — summarizer failures", () => {
  const nonRetryableError = new TypeValidationError({
    value: {},
    cause: new Error("bad"),
  });

  it("skips and counts an article whose summarizer call fails, without failing the run", async () => {
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (promptTitle(args.prompt) === "Merger closes") {
          throw nonRetryableError;
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const parsed = readNewsletterDocument(result.content);

    expect(result.articlesSkippedSummaryFailed).toBe(1);
    expect(parsed?.sections.map((section) => section.key)).toEqual([
      "competitive-landscape",
      "quick-hits",
    ]);
    expect(result.sectionFillSnapshot?.sectionsRemoved).toEqual([
      "dealsAndMovements",
    ]);
  });

  it("promotes a dedup-dropped copy when the kept representative fails to summarize", async () => {
    // Mirrors AADI on 2026-08-20: several outlets covered one event, dedup kept one, that copy
    // failed to summarize, and the section was removed because the alternates had been discarded.
    const oneEvent: SourceForGeneration[] = [
      {
        dataSourceId: "ds-byan-1",
        url: "https://example.com/byan-1",
        title: "Saham BYAN melesat usai isu diakuisisi Haji Isam",
        content:
          "Shares of Bayan Resources jumped after reports that Haji Isam would acquire a controlling stake in BYAN.",
        section: "competitiveLandscape",
        sectionScore: 0.8,
      },
      {
        dataSourceId: "ds-byan-2",
        url: "https://example.com/byan-2",
        title: "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
        content:
          "Bayan Resources responded to reports that Haji Isam would acquire a controlling stake in BYAN.",
        section: "competitiveLandscape",
        sectionScore: 0.6,
      },
      ...testSources.filter((entry) => entry.section === "quickHits"),
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (
          promptTitle(args.prompt) ===
          "Saham BYAN melesat usai isu diakuisisi Haji Isam"
        ) {
          throw nonRetryableError;
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      oneEvent,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const parsed = readNewsletterDocument(result.content);

    expect(result.summaryBackfill?.recovered).toBe(1);
    expect(result.sectionFillSnapshot?.sectionsRemoved).toEqual([]);
    expect(
      parsed?.sections
        .find((section) => section.key === "competitive-landscape")
        ?.articles.map((entry) => entry.title),
    ).toStrictEqual([
      "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
    ]);
  });

  it("never ships a dedup-dropped copy when its representative summarized", async () => {
    const oneEvent: SourceForGeneration[] = [
      {
        dataSourceId: "ds-byan-1",
        url: "https://example.com/byan-1",
        title: "Saham BYAN melesat usai isu diakuisisi Haji Isam",
        content:
          "Shares of Bayan Resources jumped after reports that Haji Isam would acquire a controlling stake in BYAN.",
        section: "competitiveLandscape",
        sectionScore: 0.8,
      },
      {
        dataSourceId: "ds-byan-2",
        url: "https://example.com/byan-2",
        title: "Bayan Resources buka suara soal rumor akuisisi Haji Isam",
        content:
          "Bayan Resources responded to reports that Haji Isam would acquire a controlling stake in BYAN.",
        section: "competitiveLandscape",
        sectionScore: 0.6,
      },
      ...testSources.filter((entry) => entry.section === "quickHits"),
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => ({
        object: {
          title: promptTitle(args.prompt),
          points: [`Key fact from ${promptTitle(args.prompt)}`],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      oneEvent,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const parsed = readNewsletterDocument(result.content);

    expect(result.summaryBackfill).toBeUndefined();
    expect(
      parsed?.sections
        .find((section) => section.key === "competitive-landscape")
        ?.articles.map((entry) => entry.title),
    ).toStrictEqual(["Saham BYAN melesat usai isu diakuisisi Haji Isam"]);
  });

  it("keeps a section alive by promoting its reserve when the selected article fails", async () => {
    const withReserve: SourceForGeneration[] = [
      ...testSources,
      {
        dataSourceId: "ds-d",
        url: "https://example.com/d",
        title: "Second merger filed",
        content: "A second regional lender filed its merger plan on Monday.",
        section: "dealsAndMovements",
        sectionScore: 0.6,
      },
      {
        dataSourceId: "ds-e",
        url: "https://example.com/e",
        title: "Third merger rumoured",
        content: "A third lender is rumoured to be preparing a merger plan.",
        section: "dealsAndMovements",
        sectionScore: 0.5,
      },
      {
        dataSourceId: "ds-f",
        url: "https://example.com/f",
        title: "Fourth merger cleared",
        content: "A fourth lender cleared its merger with the regulator.",
        section: "dealsAndMovements",
        sectionScore: 0.4,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (promptTitle(args.prompt) === "Merger closes") {
          throw nonRetryableError;
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      withReserve,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );
    const parsed = readNewsletterDocument(result.content);

    expect(result.summaryBackfill).toStrictEqual({
      attempted: 1,
      recovered: 1,
      skippedDuplicates: 0,
      bySection: { "deals-and-movements": { attempted: 1, recovered: 1 } },
    });
    expect(result.sectionFillSnapshot?.sectionsRemoved).toEqual([]);
    expect(parsed?.sections.map((section) => section.key)).toContain(
      "deals-and-movements",
    );
    expect(
      parsed?.sections
        .find((section) => section.key === "deals-and-movements")
        ?.articles.map((entry) => entry.title),
    ).toContain("Fourth merger cleared");
  });

  it("throws when every article fails to summarize", async () => {
    const generateObjectFn = makeGenerateFn({
      onSummarize: () => Promise.reject(nonRetryableError),
    });

    await expect(
      generateNewsletterWithLlm(testSources, baseConfig, testContext, {
        generateObjectFn,
        sleepFn: noopSleepFn,
      }),
    ).rejects.toThrow(/failed to summarize/i);
  });

  it("throws when selection produces no articles", async () => {
    const unassigned: SourceForGeneration[] = [
      {
        url: "https://example.com/x",
        title: "Unassigned",
        content: "Body.",
      },
    ];
    const generateObjectFn = makeGenerateFn();

    await expect(
      generateNewsletterWithLlm(unassigned, baseConfig, testContext, {
        generateObjectFn,
      }),
    ).rejects.toThrow(/no articles/i);
    expect(generateObjectFn).not.toHaveBeenCalled();
  });

  it("retries a retryable summarizer failure up to maxAttempts before skipping", async () => {
    const retryableError = new APICallError({
      message: "Too Many Requests",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    let attempts = 0;
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (promptTitle(args.prompt) === "Merger closes") {
          attempts += 1;
          throw retryableError;
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(attempts).toBe(CONTENT_GENERATION_CONSTANTS.retry.maxAttempts);
    expect(result.articlesSkippedSummaryFailed).toBe(1);
  });

  it("drops an article whose heading cites a figure the body never states", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-m0",
        url: "https://example.com/m0",
        title:
          "BI Records Primary Money Growth of 17.1% to Rp 1,154.5 Trillion in July 2026",
        content:
          "Bank Indonesia melaporkan uang primer (M0) Adjusted pada Juli 2026 tumbuh 17,1% secara tahunan menjadi Rp 2.254,5 triliun.",
        section: "industryPulse",
        sectionScore: 0.9,
      },
      ...testSources,
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => ({
        object: {
          title: promptTitle(args.prompt),
          points: [`Key fact from ${promptTitle(args.prompt)}`],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).not.toContain("1,154.5");
    expect(result.content).not.toContain("industryPulse");
    expect(result.articlesSkippedSummaryFailed).toBe(1);
  });

  it("retries once when no point carries a figure the heading states", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-hpal",
        url: "https://example.com/hpal",
        title: "Vale bersiap operasikan 3 smelter nikel HPAL",
        content:
          "PT Vale Indonesia bersiap mengoperasikan 3 smelter nikel HPAL di Sulawesi untuk mendukung hilirisasi nikel.",
        section: "dealsAndMovements",
        sectionScore: 0.9,
      },
      ...testSources,
    ];
    let hpalCalls = 0;
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (!args.prompt.includes("smelter nikel HPAL")) {
          return {
            object: {
              title: promptTitle(args.prompt),
              points: [`Key fact from ${promptTitle(args.prompt)}`],
            },
          };
        }
        hpalCalls += 1;

        return {
          object: {
            title: "Vale Prepares to Operate 3 HPAL Nickel Smelters",
            points:
              hpalCalls === 1
                ? ["The move supports nickel downstreaming in Sulawesi."]
                : ["Vale is preparing 3 HPAL nickel smelters in Sulawesi."],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(hpalCalls).toBe(2);
    expect(result.content).toContain("3 HPAL nickel smelters");
    expect(result.articlesSkippedSummaryFailed).toBe(0);
  });

  it("drops an article when the retry still carries no heading figure", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-hpal",
        url: "https://example.com/hpal",
        title: "Vale bersiap operasikan 3 smelter nikel HPAL",
        content:
          "PT Vale Indonesia bersiap mengoperasikan 3 smelter nikel HPAL di Sulawesi untuk mendukung hilirisasi nikel.",
        section: "dealsAndMovements",
        sectionScore: 0.9,
      },
      ...testSources,
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) =>
        args.prompt.includes("smelter nikel HPAL")
          ? {
              object: {
                title: "Vale Prepares to Operate 3 HPAL Nickel Smelters",
                points: ["The move supports nickel downstreaming in Sulawesi."],
              },
            }
          : {
              object: {
                title: promptTitle(args.prompt),
                points: [`Key fact from ${promptTitle(args.prompt)}`],
              },
            },
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).not.toContain("HPAL");
    expect(result.articlesSkippedSummaryFailed).toBe(1);
  });

  it("drops a second summary of one event when the sources were in different languages", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-ojk-id",
        url: "https://example.com/ojk-id",
        title: "OJK: Ekonomi On-Chain Indonesia Segera Hadir",
        content:
          "OJK menyatakan ekonomi on-chain Indonesia segera hadir dengan pengakuan penyedia aset kripto sebagai lembaga jasa keuangan.",
        section: "regulatoryPolicyWatch",
        sectionScore: 0.9,
      },
      {
        dataSourceId: "ds-ojk-en",
        url: "https://example.com/ojk-en",
        title: "OJK: Indonesia's 'On-Chain Economy' is Coming",
        content:
          "OJK sees crypto assets evolving into transactions, DeFi and tokenization as Indonesia's on-chain economy arrives.",
        section: "regulatoryPolicyWatch",
        sectionScore: 0.8,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => ({
        object: {
          title: args.prompt.includes("Segera Hadir")
            ? "OJK: Indonesia's On-Chain Economy Coming Soon"
            : "OJK: Indonesia's 'On-Chain Economy' is Coming",
          points: [
            args.prompt.includes("Segera Hadir")
              ? "OJK plans to recognise crypto asset providers as financial service institutions."
              : "OJK will regulate crypto providers as financial institutions.",
          ],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).toContain("On-Chain Economy Coming Soon");
    expect(result.content).not.toContain("'On-Chain Economy' is Coming");
  });

  it("keeps an article whose heading figure the body confirms", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-m0",
        url: "https://example.com/m0",
        title:
          "BI Records Primary Money Growth of 17.1% to Rp 2,254.5 Trillion in July 2026",
        content:
          "Bank Indonesia melaporkan uang primer (M0) Adjusted pada Juli 2026 tumbuh 17,1% secara tahunan menjadi Rp 2.254,5 triliun.",
        section: "industryPulse",
        sectionScore: 0.9,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => ({
        object: {
          title: promptTitle(args.prompt),
          points: [`Uang primer tumbuh 17,1% pada Juli 2026`],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.articlesSkippedSummaryFailed).toBe(0);
    expect(result.content).toContain("2,254.5");
  });

  it("drops a figure-bearing point when the source carries only its description", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-bri",
        url: "https://example.com/bri",
        title: "BRI shares rise on foreign buying",
        content:
          "Saham BRI naik 1,07% ke Rp 3.100 pada 7 Agustus 2026, didorong beli asing dengan nilai transaksi Rp 664,81 miliar.",
        contentIsDescriptionOnly: true,
        section: "competitiveLandscape",
        sectionScore: 0.9,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async () => ({
        object: {
          title: "BRI shares rise on foreign buying",
          points: [
            "Foreign investors bought BRI shares worth Rp 664.81 billion",
            "BRI shares closed higher on the day",
          ],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).not.toContain("664.81");
    expect(result.content).toContain("BRI shares closed higher on the day");
  });

  it("drops a point naming operators the article's own title never names", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-ntt",
        url: "https://nasional.kompas.com/read/gempa-ntt-200-bts",
        title:
          "Gempa NTT: 200 BTS Terdampak, Komdigi Pantau Pemulihan Jaringan Komunikasi",
        content:
          "Gempa Magnitudo 7,7 di Flores sebabkan gangguan serius pada 200 BTS Telkomsel, XLsmart, & Indosat di NTT. Komdigi terus pantau pemulihan.",
        contentIsDescriptionOnly: true,
        section: "regulatoryPolicyWatch",
        sectionScore: 0.5,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async () => ({
        object: {
          title: "NTT Earthquake: 200 BTS Affected, Komdigi Monitors Recovery",
          points: [
            "The quake disrupted 200 BTS from Telkomsel, XLsmart, and Indosat in NTT",
            "Komdigi is monitoring the recovery of the 200 affected BTS",
          ],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).not.toContain("Telkomsel");
    expect(result.content).not.toContain("Indosat");
    expect(result.content).toContain(
      "Komdigi is monitoring the recovery of the 200 affected BTS",
    );
  });

  it("keeps a description-only point whose names the title carries", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-bi",
        url: "https://example.com/bi-kki",
        title: "BI Luncurkan Kartu Kredit Indonesia",
        content: "Bank Indonesia meluncurkan Kartu Kredit Indonesia.",
        contentIsDescriptionOnly: true,
        section: "regulatoryPolicyWatch",
        sectionScore: 0.8,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async () => ({
        object: {
          title: "BI launches the Indonesian Credit Card",
          points: [
            "The central bank said Bank Indonesia launched the Indonesian Credit Card",
          ],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).toContain("Bank Indonesia launched");
  });

  it("keeps a figure-bearing point when the source carries a fetched body", async () => {
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-bri",
        url: "https://example.com/bri",
        title: "BRI shares rise on foreign buying",
        content:
          "Investor asing tercatat melakukan net buy senilai Rp 309,37 miliar pada perdagangan itu.",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSummarize: async () => ({
        object: {
          title: "BRI shares rise on foreign buying",
          points: [
            "Foreign investors bought BRI shares worth Rp 309.37 billion",
          ],
        },
      }),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.content).toContain("309.37");
  });

  it("drops an article when the summarizer returns no points", async () => {
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (promptTitle(args.prompt) === "Merger closes") {
          return { object: { title: promptTitle(args.prompt), points: [] } };
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.articlesSkippedSummaryFailed).toBe(1);
    expect(result.content).not.toContain("Merger closes");
  });

  it("recovers when a transient summarizer failure succeeds on retry", async () => {
    const retryableError = new APICallError({
      message: "Server Error",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
    });
    let failedOnce = false;
    const generateObjectFn = makeGenerateFn({
      onSummarize: async (args) => {
        if (!failedOnce) {
          failedOnce = true;
          throw retryableError;
        }

        return {
          object: {
            title: promptTitle(args.prompt),
            points: [`Key fact from ${promptTitle(args.prompt)}`],
          },
        };
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.articlesSkippedSummaryFailed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Subject fallback
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — subject fallback", () => {
  it("falls back to the lead article title, truncated, when the subject call fails", async () => {
    const longTitle = "R".repeat(MAX_SUBJECT_LENGTH + 10);
    const sources: SourceForGeneration[] = [
      {
        dataSourceId: "ds-lead",
        url: "https://example.com/lead",
        title: longTitle,
        content: "Body for the lead story.",
        section: "industryPulse",
        sectionScore: 0.9,
      },
    ];
    const generateObjectFn = makeGenerateFn({
      onSubject: () =>
        Promise.reject(
          new TypeValidationError({ value: {}, cause: new Error("bad") }),
        ),
    });

    const result = await generateNewsletterWithLlm(
      sources,
      baseConfig,
      testContext,
      { generateObjectFn, sleepFn: noopSleepFn },
    );

    expect(result.subject).toContain("R".repeat(MAX_SUBJECT_LENGTH));
    expect(result.subject).not.toContain("R".repeat(MAX_SUBJECT_LENGTH + 1));
    expect(result.content.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Token usage and provenance
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — token usage and provenance", () => {
  it("sums token usage across every summarizer call and the subject call", async () => {
    const generateObjectFn = makeGenerateFn({
      usage: {
        promptTokens: 10,
        completionTokens: 4,
        totalTokens: 14,
        reasoningTokens: 2,
      },
    });

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );
    const callCount = testSources.length + 1;

    expect(result.promptTokens).toBe(10 * callCount);
    expect(result.completionTokens).toBe(4 * callCount);
    expect(result.totalTokens).toBe(14 * callCount);
    expect(result.structuredReasoningTokens).toBe(2 * callCount);
  });

  it("returns null token fields when no response carried usage", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.promptTokens).toBeNull();
    expect(result.completionTokens).toBeNull();
    expect(result.totalTokens).toBeNull();
    expect(result.structuredReasoningTokens).toBeUndefined();
  });

  it("reports the summarizer system prompt and an article manifest as the prompts", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.systemPrompt).toBe(SUMMARIZE_ARTICLE_SYSTEM_PROMPT);
    expect(result.resolvedUserPrompt).toBe(
      [
        "competitive-landscape | Rival A expands",
        "deals-and-movements | Merger closes",
        "quick-hits | Nickel shipments rise",
      ].join("\n"),
    );
  });

  it("does not carry article bodies into the resolved user prompt", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.resolvedUserPrompt).not.toContain(
      "Nickel ore shipments rose across Sulawesi smelters",
    );
  });

  it("appends the contract brief to the summarizer system prompt", async () => {
    const generateObjectFn = makeGenerateFn();

    const withBrief = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      { ...testContext, brief: "Focus on Indonesian banking sector dynamics." },
      { generateObjectFn },
    );

    expect(withBrief.systemPrompt).not.toBe(SUMMARIZE_ARTICLE_SYSTEM_PROMPT);
    expect(withBrief.systemPrompt).toContain(SUMMARIZE_ARTICLE_SYSTEM_PROMPT);
  });
});

// ---------------------------------------------------------------------------
// sectionFillSnapshot and provenance links
// ---------------------------------------------------------------------------

describe("generateNewsletterWithLlm — provenance links", () => {
  it("has a sectionFill entry for every canonical section", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(Object.keys(result.sectionFillSnapshot?.bySection ?? {})).toEqual(
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

  it("links every shipped article back to its data source", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      testSources,
      baseConfig,
      testContext,
      { generateObjectFn },
    );

    expect(result.newsletterCitations).toEqual([
      { dataSourceId: "ds-b", sectionKey: "competitiveLandscape" },
      { dataSourceId: "ds-c", sectionKey: "dealsAndMovements" },
      { dataSourceId: "ds-a", sectionKey: "quickHits" },
    ]);
    expect(result.newsletterSections).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Cross-day dedup, ahead of the LLM calls
// ---------------------------------------------------------------------------

const DUP_TEXT =
  "Acme Bank acquires rival fintech startup for five hundred million dollars";
const NOVEL_TEXT =
  "Regulator publishes fresh capital adequacy guidance for digital lenders";

const crossRunSources: SourceForGeneration[] = [
  {
    dataSourceId: "ds-dup",
    url: "https://example.com/dup",
    title: "Acme acquires fintech",
    content: DUP_TEXT,
    section: "competitiveLandscape",
    sectionScore: 0.9,
  },
  {
    dataSourceId: "ds-novel",
    url: "https://example.com/novel",
    title: "Regulator publishes guidance",
    content: NOVEL_TEXT,
    section: "competitiveLandscape",
    sectionScore: 0.8,
  },
];

describe("generateNewsletterWithLlm — cross-day dedup", () => {
  it("drops a repeated source before it is ever summarized", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      crossRunSources,
      baseConfig,
      {
        ...testContext,
        recentBullets: [
          { sectionKey: "competitiveLandscape", bulletText: DUP_TEXT },
        ],
      },
      { generateObjectFn },
    );
    const summarizedTitles = vi
      .mocked(generateObjectFn)
      .mock.calls.map(([args]) => args)
      .filter((args) => !isSubjectCall(args))
      .map((args) => promptTitle(args.prompt));

    expect(result.crossRunDedupSummary?.removedCount).toBe(1);
    expect(result.crossRunDedupSummary?.bySection["competitiveLandscape"]).toBe(
      1,
    );
    expect(summarizedTitles).toEqual(["Regulator publishes guidance"]);
  });

  it("runs no dedup pass when no recent bullets are provided", async () => {
    const generateObjectFn = makeGenerateFn();

    const result = await generateNewsletterWithLlm(
      crossRunSources,
      baseConfig,
      { ...testContext },
      { generateObjectFn },
    );

    expect(result.crossRunDedupSummary).toBeUndefined();
    expect(result.content).toContain("Acme acquires fintech");
  });
});

const backfillArticle = (
  title: string,
  sectionKey = "issuer-performance",
): SelectedArticle =>
  ({
    sectionKey,
    source: { url: `https://example.com/${title}`, title, content: "Body." },
  }) as SelectedArticle;

const backfillSummarized = (entry: SelectedArticle) => ({
  status: "summarized" as const,
  entry,
  title: entry.source.title,
  points: ["A point."],
});

const backfillFailed = (entry: SelectedArticle) => ({
  status: "failed" as const,
  entry,
  reason: "llm_error" as const,
});

const backfillEventArticle = (
  title: string,
  content: string,
  sectionKey = "issuer-performance",
): SelectedArticle =>
  ({
    sectionKey,
    source: { url: `https://example.com/${title}`, title, content },
  }) as SelectedArticle;

const BRIMO_REPRESENTATIVE = backfillEventArticle(
  "BRImo Taiwan launched by BRI for migrant workers",
  "BRI launched BRImo Taiwan digital banking service for Indonesian migrant workers in Taipei.",
  "deals-and-movements",
);

const BRIMO_DUPLICATE = backfillEventArticle(
  "BRI officially launches BRImo Taiwan for diaspora",
  "BRI officially launched BRImo Taiwan digital banking for Indonesian diaspora and migrant workers in Taipei.",
  "quick-hits",
);

const UNRELATED_POLICY = backfillEventArticle(
  "QRIS merchant discount rate cut to zero",
  "Bank Indonesia expands the zero merchant discount rate for QRIS transactions from October.",
  "quick-hits",
);

describe("backfillFailedSections", () => {
  it("replaces a failed article with the next-ranked reserve candidate", async () => {
    const lost = backfillArticle("Lost");
    const spare = backfillArticle("Spare");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillFailed(lost)],
      reserve: [spare],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize).toHaveBeenCalledWith(spare);
    expect(result.attempted).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.bySection["issuer-performance"]).toStrictEqual({
      attempted: 1,
      recovered: 1,
    });
  });

  it("draws only from the section that came up short", async () => {
    const lost = backfillArticle("Lost", "issuer-performance");
    const otherSection = backfillArticle("Other", "quick-hits");
    const sameSection = backfillArticle("Same", "issuer-performance");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    await backfillFailedSections({
      outcomes: [backfillFailed(lost)],
      reserve: [otherSection, sameSection],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize).toHaveBeenCalledWith(sameSection);
  });

  it("takes at most one reserve candidate per failure", async () => {
    const lost = backfillArticle("Lost");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillFailed(lost)],
      reserve: [backfillArticle("Spare One"), backfillArticle("Spare Two")],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.attempted).toBe(1);
  });

  it("does not retry when a backfill candidate also fails", async () => {
    const lost = backfillArticle("Lost");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillFailed(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillFailed(lost)],
      reserve: [backfillArticle("Spare"), backfillArticle("Never Tried")],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.attempted).toBe(1);
    expect(result.recovered).toBe(0);
  });

  it("leaves a section with no reserve exactly as it was", async () => {
    const lost = backfillArticle("Lost");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillFailed(lost)],
      reserve: [],
      summarize,
    });

    expect(summarize).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      outcomes: [backfillFailed(lost)],
      attempted: 0,
      recovered: 0,
      skippedDuplicates: 0,
      bySection: {},
    });
  });

  it("skips a reserve duplicate of an event already summarized in another section", async () => {
    const lostQuickHit = backfillArticle("Lost", "quick-hits");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [
        backfillSummarized(BRIMO_REPRESENTATIVE),
        backfillFailed(lostQuickHit),
      ],
      reserve: [BRIMO_DUPLICATE, UNRELATED_POLICY],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize).toHaveBeenCalledWith(UNRELATED_POLICY);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.attempted).toBe(1);
    expect(result.recovered).toBe(1);
  });

  it("still promotes a duplicate when its representative failed to summarize", async () => {
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillFailed(BRIMO_REPRESENTATIVE)],
      reserve: [
        backfillEventArticle(
          BRIMO_DUPLICATE.source.title,
          BRIMO_DUPLICATE.source.content,
          "deals-and-movements",
        ),
      ],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.skippedDuplicates).toBe(0);
    expect(result.recovered).toBe(1);
  });

  it("promotes only one copy when the reserve holds several of one event", async () => {
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [
        backfillFailed(backfillArticle("Lost One", "quick-hits")),
        backfillFailed(backfillArticle("Lost Two", "quick-hits")),
      ],
      reserve: [
        backfillEventArticle(
          BRIMO_REPRESENTATIVE.source.title,
          BRIMO_REPRESENTATIVE.source.content,
          "quick-hits",
        ),
        BRIMO_DUPLICATE,
        UNRELATED_POLICY,
      ],
      summarize,
    });

    expect(summarize).toHaveBeenCalledTimes(2);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.attempted).toBe(2);
  });

  it("does nothing when every selected article summarized", async () => {
    const kept = backfillArticle("Kept");
    const summarize = vi.fn(async (entry: SelectedArticle) =>
      backfillSummarized(entry),
    );

    const result = await backfillFailedSections({
      outcomes: [backfillSummarized(kept)],
      reserve: [backfillArticle("Spare")],
      summarize,
    });

    expect(summarize).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });
});

describe("countSummaryFailureReasons", () => {
  it("reports every reason so an absent cause reads as zero, not as missing", () => {
    const counts = countSummaryFailureReasons([]);

    expect(Object.keys(counts).sort()).toEqual(
      [...SUMMARY_FAILURE_REASONS].sort(),
    );
    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
  });

  it("counts each failed outcome against its own cause", () => {
    const counts = countSummaryFailureReasons([
      { status: "failed", reason: "llm_error" },
      { status: "failed", reason: "llm_error" },
      { status: "failed", reason: "points_ungrounded" },
      { status: "failed", reason: "title_figure_ungrounded" },
      { status: "summarized" },
    ]);

    expect(counts.llm_error).toBe(2);
    expect(counts.points_ungrounded).toBe(1);
    expect(counts.title_figure_ungrounded).toBe(1);
    expect(counts.points_unusable).toBe(0);
    expect(counts.points_off_heading).toBe(0);
  });

  it("ignores summarized outcomes even when one carries a stray reason", () => {
    const counts = countSummaryFailureReasons([
      { status: "summarized", reason: "llm_error" },
    ]);

    expect(counts.llm_error).toBe(0);
  });
});
