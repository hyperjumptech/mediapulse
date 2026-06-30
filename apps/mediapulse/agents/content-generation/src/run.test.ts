/** @vitest-environment node */
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
const newsletterTranslationCreate = vi.fn();

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
    newsletterTranslation: {
      create: newsletterTranslationCreate,
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
import * as TranslateNewsletter from "./translate-newsletter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_TICKER_ID = "00000000-0000-4000-8000-000000000001" as const;

const baseConfig: ContentGenerationConfig = ContentGenerationConfigSchema.parse(
  {
    model: { apiKey: "sk-test", model: "gpt-4o" },
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
    section: "quickHits",
    sectionScore: 0.9,
  },
];

function makeGetResponse(
  overrides?: Partial<{
    dataSources: unknown;
    tickerSymbol: string;
    tickerName: string;
    competitors: unknown[];
    issuerAliases: string[];
    subscriberLanguages: string[];
  }>,
) {
  return {
    dataSources: testSources,
    tickerSymbol: "BBCA",
    tickerName: "Bank Central Asia",
    competitors: [],
    issuerAliases: [],
    subscriberLanguages: [],
    ...overrides,
  };
}

const generatedNewsletter: LlmGenerate.GeneratedContentWithProvenance = {
  subject: "BBCA Pulse: Daily Briefing",
  content: "INDUSTRY PULSE\nMarkets rose.\n\nQUICK HITS\n1. Story A",
  description: "Markets rose for the third day.",
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  systemPrompt: "You are an industry intelligence editor.",
  resolvedUserPrompt:
    "Create a newsletter from these data sources.\n\nArticle 1: Story A\nContent for story A.",
  citationGroundingSummary: {
    totalCitations: 1,
    unlinked: 0,
    dropped: 0,
    floorPreserved: 0,
    p50Overlap: 0.5,
    p10Overlap: 0.2,
  },
  requireCitationSummary: {
    sectionsRemoved: 0,
    bulletsRemovedUncited: 0,
    bulletsRemovedDuplicate: 0,
    bulletsRemovedDuplicateTitle: 0,
    sectionsKept: 6,
  },
  sectionFillSnapshot: {
    bySection: {
      industryPulse: { citedBullets: 1 },
      competitiveLandscape: { citedBullets: 2 },
      dealsAndMovements: { citedBullets: 1 },
      regulatoryPolicyWatch: { citedBullets: 1 },
      disruptorsOrTech: { citedBullets: 1 },
      quickHits: { citedBullets: 5 },
    },
    sectionsRemoved: [],
  },
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
    newsletterTranslationCreate.mockReset();
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns success when sources exist and LLM and persist succeed", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(contentGenerationGet).toHaveBeenCalledTimes(1);
    expect(LlmGenerate.generateNewsletterWithLlm).toHaveBeenCalledTimes(1);
    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // No sources → skipped outcome
  // -------------------------------------------------------------------------

  it("returns success:true with 'no sources found' message when no sources", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(
      makeGetResponse({ dataSources: [] }),
    );

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(result.message).toContain("No data sources found");
    expect(LlmGenerate.generateNewsletterWithLlm).not.toHaveBeenCalled();
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  it("returns success:true when dataSources is null", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(
      makeGetResponse({ dataSources: null }),
    );

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(result.message).toContain("No data sources found");
  });

  // -------------------------------------------------------------------------
  // Skip-if-duplicate: newsletter exists in window → skipped
  // -------------------------------------------------------------------------

  it("returns success:true with skipped message when a newsletter already exists for the ticker today", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: true,
      newsletterId: "nl-existing-123",
    });

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(result.message).toContain(
      `Newsletter already generated for ${TEST_TICKER_ID} today (skipped)`,
    );
    expect(contentGenerationGet).not.toHaveBeenCalled();
    expect(LlmGenerate.generateNewsletterWithLlm).not.toHaveBeenCalled();
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  it("proceeds normally when no newsletter exists for the ticker today", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(contentGenerationGet).toHaveBeenCalledTimes(1);
    expect(LlmGenerate.generateNewsletterWithLlm).toHaveBeenCalledTimes(1);
    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Duplicate-guard: precheck window uses the configured timezone
  // -------------------------------------------------------------------------

  it("uses the configured timezone from duplicateGuard for the precheck window", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    const computeSpy = vi.spyOn(FreshnessWindow, "computeFreshnessWindow");

    await run(
      makeContext({
        config: { duplicateGuard: { timezone: "America/New_York" } },
      }),
    );

    expect(computeSpy).toHaveBeenCalledWith("America/New_York");
  });

  // -------------------------------------------------------------------------
  // LLM errors → OutcomeCode in message
  // -------------------------------------------------------------------------

  it("returns success:false with openai_non_retryable on auth failure", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
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

    const result = await run(makeContext());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("openai_non_retryable");
    }
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });

  it("returns success:false with validation_failed on TypeValidationError", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    const { TypeValidationError } = await import("ai");
    const validationError = new TypeValidationError({
      value: { bad: true },
      cause: new Error("schema mismatch"),
    });
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      validationError,
    );

    const result = await run(makeContext());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("validation_failed");
    }
  });

  // -------------------------------------------------------------------------
  // Persist errors → OutcomeCode in message
  // -------------------------------------------------------------------------

  it("returns success:false with persist_transient on 429 from agent-data-api", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 429"),
    );

    const result = await run(makeContext());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_transient");
    }
  });

  it("returns success:false with persist_client_error on 400 from agent-data-api", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );
    contentGenerationCreate.mockRejectedValue(
      new Error("Agent data API error: 400"),
    );

    const result = await run(makeContext());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("persist_client_error");
    }
  });

  // -------------------------------------------------------------------------
  // Config + context propagation to generateNewsletterWithLlm
  // -------------------------------------------------------------------------

  it("passes the resolved model config and grouped sources to generateNewsletterWithLlm", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    const generateSpy = vi
      .spyOn(LlmGenerate, "generateNewsletterWithLlm")
      .mockResolvedValue(generatedNewsletter);

    const result = await run(makeContext());

    expect(result.success).toBe(true);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const secondArg = generateSpy.mock.calls[0]![1];
    expect(secondArg.model.model).toBe("gpt-4o");
    expect(secondArg.duplicateGuard.timezone).toBe("Asia/Jakarta");
  });

  it("passes tickerId, current date, and ticker subject to generateNewsletterWithLlm", async () => {
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    const generateSpy = vi
      .spyOn(LlmGenerate, "generateNewsletterWithLlm")
      .mockResolvedValue(generatedNewsletter);

    await run(makeContext());

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const thirdArg = generateSpy.mock.calls[0]![2];
    expect(thirdArg.tickerId).toBe(TEST_TICKER_ID);
    expect(thirdArg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(thirdArg.tickerSymbol).toBe("BBCA");
    expect(thirdArg.tickerName).toBe("Bank Central Asia");
  });

  // -------------------------------------------------------------------------
  // Subscription-driven translation
  // -------------------------------------------------------------------------

  describe("subscription-driven translation", () => {
    it("does not translate when no subscriber languages are returned", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(
        makeGetResponse({ subscriberLanguages: [] }),
      );
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(newsletterTranslationCreate).not.toHaveBeenCalled();
    });

    it("translates once per supported subscriber language and persists each", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(
        makeGetResponse({ subscriberLanguages: ["id"] }),
      );
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );
      const translateSpy = vi
        .spyOn(TranslateNewsletter, "translateNewsletter")
        .mockResolvedValue({
          subject: "id subject",
          content: "id content",
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });
      newsletterTranslationCreate.mockResolvedValue({ message: "ok" });

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(translateSpy).toHaveBeenCalledTimes(1);
      expect(translateSpy.mock.calls[0]![0].targetLanguage).toBe("id");
      expect(newsletterTranslationCreate).toHaveBeenCalledTimes(1);
      const createArg = newsletterTranslationCreate.mock.calls[0]![0];
      expect(createArg.newsletterId).toBe("nl-1");
      expect(createArg.language).toBe("id");
    });

    it("skips unsupported subscriber languages without translating", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(
        makeGetResponse({ subscriberLanguages: ["fr"] }),
      );
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );
      const translateSpy = vi.spyOn(TranslateNewsletter, "translateNewsletter");

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(translateSpy).not.toHaveBeenCalled();
      expect(newsletterTranslationCreate).not.toHaveBeenCalled();
    });

    it("does not fail the run when translation throws (best-effort)", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(
        makeGetResponse({ subscriberLanguages: ["id"] }),
      );
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );
      vi.spyOn(TranslateNewsletter, "translateNewsletter").mockRejectedValue(
        new Error("translation boom"),
      );

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(newsletterTranslationCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Diagnostic write
  // -------------------------------------------------------------------------

  describe("diagnostic write", () => {
    it("calls contentGenerationRuns.create with outcome=success on the happy path", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(makeGetResponse());
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-1" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.outcome).toBe("success");
      expect(callArg.stage).toBeNull();
      expect(callArg.errorCode).toBeNull();
      expect(callArg.agentId).toBe("content-generation");
      expect(callArg.tickerId).toBe(TEST_TICKER_ID);
      expect(callArg.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("calls contentGenerationRuns.create with errorCode=no_sources on the no-sources path", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(
        makeGetResponse({ dataSources: [] }),
      );
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-2" });

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      expect(contentGenerationRunsCreate).toHaveBeenCalledOnce();
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.errorCode).toBe("no_sources");
    });

    it("calls contentGenerationRuns.create with errorCode=skipped_fresh_newsletter_exists on the duplicate path", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: true,
        newsletterId: "nl-existing",
      });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id-3" });

      const result = await run(makeContext());

      expect(result.success).toBe(true);
      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.errorCode).toBe("skipped_fresh_newsletter_exists");
    });

    it("swallows diagnostic write failure and does not change the primary AgentRunResult", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(makeGetResponse());
      contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
      contentGenerationRunsCreate.mockRejectedValue(new Error("diag boom"));
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      const result = await run(makeContext());

      expect(result.success).toBe(true);
    });

    it("forwards newsletterId from persist response to the diagnostic record on success", async () => {
      contentGenerationNewslettersLatestGet.mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });
      contentGenerationGet.mockResolvedValue(makeGetResponse());
      contentGenerationCreate.mockResolvedValue({
        message: "ok",
        id: "nl-success-id",
      });
      contentGenerationRunsCreate.mockResolvedValue({ id: "run-id" });
      vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
        generatedNewsletter,
      );

      await run(makeContext());

      const callArg = contentGenerationRunsCreate.mock.calls[0]![0];
      expect(callArg.newsletterId).toBe("nl-success-id");
    });
  });
});

// ---------------------------------------------------------------------------
// Provenance fields in contentGeneration.create
// ---------------------------------------------------------------------------

describe("provenance fields in contentGeneration.create", () => {
  beforeEach(() => {
    contentGenerationGet.mockReset();
    contentGenerationCreate.mockReset();
    contentGenerationNewslettersLatestGet.mockReset();
    contentGenerationRunsCreate.mockReset();
    newsletterTranslationCreate.mockReset();
    contentGenerationNewslettersLatestGet.mockResolvedValue({
      hasNewsletter: false,
      newsletterId: null,
    });
    contentGenerationGet.mockResolvedValue(makeGetResponse());
    contentGenerationCreate.mockResolvedValue({ message: "ok", id: "nl-1" });
    contentGenerationRunsCreate.mockResolvedValue({ id: "run-id" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls contentGeneration.create with all provenance fields on the success path", async () => {
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    await run(makeContext());

    expect(contentGenerationCreate).toHaveBeenCalledTimes(1);
    const callArg = contentGenerationCreate.mock.calls[0]![0];
    expect(callArg.model).toBe("gpt-4o");
    expect(typeof callArg.agentVersion).toBe("string");
    expect(typeof callArg.configVersion).toBe("string");
    expect(typeof callArg.promptHash).toBe("string");
    expect(callArg.configSnapshotId).toBe(callArg.configVersion);
    expect(callArg.promptTokens).toBe(100);
    expect(callArg.completionTokens).toBe(50);
    expect(callArg.totalTokens).toBe(150);
  });

  it("uses the model from config.model.model as the provenance model field", async () => {
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue(
      generatedNewsletter,
    );

    await run(
      makeContext({
        config: { model: { ...baseConfig.model, model: "gpt-4o-mini" } },
      }),
    );

    const callArg = contentGenerationCreate.mock.calls[0]![0];
    expect(callArg.model).toBe("gpt-4o-mini");
  });

  it("produces different promptHash values when source content changes", async () => {
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValueOnce({
      ...generatedNewsletter,
      resolvedUserPrompt: "prompt one",
    });
    await run(makeContext());
    const firstHash = contentGenerationCreate.mock.calls[0]![0].promptHash;

    contentGenerationCreate.mockClear();
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValueOnce({
      ...generatedNewsletter,
      resolvedUserPrompt: "prompt two — different",
    });
    await run(makeContext());
    const secondHash = contentGenerationCreate.mock.calls[0]![0].promptHash;

    expect(firstHash).not.toBe(secondHash);
  });

  it("passes undefined for token fields and logs a warning when LLM usage is absent", async () => {
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockResolvedValue({
      ...generatedNewsletter,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });

    await run(makeContext());

    const callArg = contentGenerationCreate.mock.calls[0]![0];
    expect(callArg.promptTokens).toBeUndefined();
    expect(callArg.completionTokens).toBeUndefined();
    expect(callArg.totalTokens).toBeUndefined();
    const { logger } = await import("@workspace/logger");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tickerId: TEST_TICKER_ID }),
      "Token usage absent from LLM response; storing null for token fields",
    );
  });

  it("does not call contentGeneration.create when LLM generation fails", async () => {
    vi.spyOn(LlmGenerate, "generateNewsletterWithLlm").mockRejectedValue(
      new Error("llm boom"),
    );

    const result = await run(makeContext());

    expect(result.success).toBe(false);
    expect(contentGenerationCreate).not.toHaveBeenCalled();
  });
});
