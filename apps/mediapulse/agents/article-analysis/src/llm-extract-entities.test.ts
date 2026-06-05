/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { APICallError, NoObjectGeneratedError } from "ai";

import type { ResolvedExemplar } from "./exemplars/default-extraction-exemplars.js";
import {
  partitionExtractionByVocabulary,
  type BadEntityRecord,
} from "./analysis-vocabulary.js";
import {
  applyRelationCritiqueDrops,
  buildExtractionModelMessages,
  buildExtractionSystemContent,
  buildExtractionUserContent,
  buildBrainstormFollowUpUserContent,
  buildBrainstormSystemContent,
  buildBrainstormUserContent,
  buildRelationCritiqueModelMessages,
  buildRelationCritiqueSystemContent,
  buildRelationCritiqueUserContent,
  buildVocabularyRepairSystemContent,
  classifyLlmExtractionError,
  classifyNoResponseSubtype,
  executeLlmCallWithTransientRetries,
  extractEntitiesAndRelationsForSource,
  repairExtractionVocabulary,
  vocabularyRepairPreservesIdentity,
  fetchArticleBrainstorm,
  llmExtractionOpenAiWireSchema,
  normalizeLlmExtractionWire,
  normalizeLlmUsageFromSdk,
  parseArticleBrainstormText,
} from "./llm-extract-entities.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("buildExtractionSystemContent", () => {
  it("includes vocabulary ids and labels", () => {
    // Act
    const text = buildExtractionSystemContent({
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });
    // Assert
    expect(text).toContain(TID);
    expect(text).toContain("Company");
    expect(text).toContain(RID);
    expect(text).toContain("PART_OF");
    expect(text).toContain("articleMentions");
  });
});

describe("buildExtractionUserContent", () => {
  it("includes ticker title and body", () => {
    const u = buildExtractionUserContent({
      tickerId: "T",
      tickerSymbol: "TSYM",
      tickerName: "Ticker Name",
      title: "Hello",
      contentTruncated: "Body text",
    });
    expect(u).toContain("T");
    expect(u).toContain("TSYM");
    expect(u).toContain("Ticker Name");
    expect(u).toContain("Hello");
    expect(u).toContain("Body text");
  });
});

describe("buildExtractionModelMessages", () => {
  const systemContent = "system prompt";
  const userContent = "real article user prompt";

  const exemplar = (id: string, snippet: string): ResolvedExemplar => ({
    archetype: "earnings",
    articleSnippet: snippet,
    expectedOutput: {
      entities: [
        {
          canonicalName: id,
          typeId: TID,
          description: "",
          aliases: [],
        },
      ],
      relations: [],
      articleMentions: [],
    },
  });

  it("inserts exemplar turns between system and the real user message", () => {
    // Act
    const messages = buildExtractionModelMessages(systemContent, userContent, [
      exemplar("One", "snippet one"),
      exemplar("Two", "snippet two"),
    ]);

    // Assert
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[1]?.content).toContain("snippet one");
    expect(messages[2]?.content).toContain('"One"');
    expect(messages[3]?.content).toContain("snippet two");
    expect(messages[5]?.content).toBe(userContent);
  });

  it("returns the existing two-turn shape when no exemplars are provided", () => {
    // Act
    const messages = buildExtractionModelMessages(systemContent, userContent);

    // Assert
    expect(messages).toEqual([
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ]);
  });

  it("appends a brainstorm follow-up user turn after the article user message", () => {
    const brainstormText =
      "KEY PLAYERS:\n- Apple\n- Tim Cook\nEVENTS:\n- Q2 earnings beat";

    // Act
    const messages = buildExtractionModelMessages(
      systemContent,
      userContent,
      [],
      brainstormText,
    );

    // Assert
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "user",
    ]);
    expect(messages[2]?.content).toBe(
      buildBrainstormFollowUpUserContent(brainstormText),
    );
    expect(String(messages[2]?.content)).toContain("Apple");
  });
});

describe("extractEntitiesAndRelationsForSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes few-shot turns to generateObject in order", async () => {
    // Setup
    const generateObjectForExtraction = vi.fn().mockResolvedValue({
      object: {
        entities: [],
        relations: [],
        articleMentions: [],
      },
      usage: null,
    });
    const exemplars: ResolvedExemplar[] = [
      {
        archetype: "earnings",
        articleSnippet: "snippet one",
        expectedOutput: {
          entities: [
            {
              canonicalName: "One",
              typeId: TID,
              description: "",
              aliases: [],
            },
          ],
          relations: [],
          articleMentions: [],
        },
      },
      {
        archetype: "leadership",
        articleSnippet: "snippet two",
        expectedOutput: {
          entities: [
            {
              canonicalName: "Two",
              typeId: TID,
              description: "",
              aliases: [],
            },
          ],
          relations: [],
          articleMentions: [],
        },
      },
    ];

    // Act
    await extractEntitiesAndRelationsForSource(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages: [
          { role: "system", content: "system prompt" },
          { role: "user", content: "real user prompt" },
        ],
        exemplars,
      },
      { generateObjectForExtraction },
    );

    // Assert
    const capturedMessages =
      generateObjectForExtraction.mock.calls[0]?.[0]?.messages;
    expect(
      capturedMessages?.map((message: { role: string }) => message.role),
    ).toEqual(["system", "user", "assistant", "user", "assistant", "user"]);
    expect(capturedMessages?.[5]?.content).toBe("real user prompt");
  });

  it("keeps the legacy two-turn message array when exemplars are omitted", async () => {
    // Setup
    const generateObjectForExtraction = vi.fn().mockResolvedValue({
      object: {
        entities: [],
        relations: [],
        articleMentions: [],
      },
      usage: null,
    });
    const messages = [
      { role: "system" as const, content: "system prompt" },
      { role: "user" as const, content: "real user prompt" },
    ];

    // Act
    await extractEntitiesAndRelationsForSource(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages,
      },
      { generateObjectForExtraction },
    );

    // Assert
    expect(generateObjectForExtraction.mock.calls[0]?.[0]?.messages).toEqual(
      messages,
    );
  });

  it("includes brainstorm text in the structured-pass messages when provided", async () => {
    // Setup
    const generateObjectForExtraction = vi.fn().mockResolvedValue({
      object: {
        entities: [],
        relations: [],
        articleMentions: [],
      },
      usage: null,
    });
    const brainstormText =
      "KEY PLAYERS:\n- Apple\n- Tim Cook\nEVENTS:\n- Q2 earnings beat";
    const messages = [
      { role: "system" as const, content: "system prompt" },
      { role: "user" as const, content: "real user prompt" },
    ];

    // Act
    await extractEntitiesAndRelationsForSource(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages,
        brainstormText,
      },
      { generateObjectForExtraction },
    );

    // Assert
    const capturedMessages =
      generateObjectForExtraction.mock.calls[0]?.[0]?.messages;
    const lastCaptured = capturedMessages
      ? capturedMessages[capturedMessages.length - 1]
      : undefined;
    expect(lastCaptured?.content).toBe(
      buildBrainstormFollowUpUserContent(brainstormText),
    );
    expect(String(lastCaptured?.content)).toContain("Apple");
  });
});

describe("buildBrainstormSystemContent", () => {
  it("returns plain-text instructions without JSON schema wording", () => {
    const text = buildBrainstormSystemContent({
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });

    expect(text).toContain("KEY PLAYERS");
    expect(text).toContain("Plain text only, no JSON");
    expect(text).not.toContain(TID);
  });
});

describe("buildBrainstormUserContent", () => {
  it("matches extraction user content for the same article fields", () => {
    const args = {
      tickerId: "T",
      tickerSymbol: "TSYM",
      tickerName: "Ticker Name",
      title: "Hello",
      contentTruncated: "Body text",
    };

    expect(buildBrainstormUserContent(args)).toBe(
      buildExtractionUserContent(args),
    );
  });
});

describe("parseArticleBrainstormText", () => {
  it("parses bullet sections into ArticleBrainstorm arrays", () => {
    const parsed = parseArticleBrainstormText(
      [
        "KEY PLAYERS:",
        "- Apple",
        "- Tim Cook",
        "EVENTS:",
        "- Q2 earnings beat",
      ].join("\n"),
    );

    expect(parsed.keyPlayers).toEqual(["Apple", "Tim Cook"]);
    expect(parsed.events).toEqual(["Q2 earnings beat"]);
    expect(parsed.relationships).toEqual([]);
    expect(parsed.sentimentNotes).toEqual([]);
  });
});

describe("fetchArticleBrainstorm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns text and usage from generateText", async () => {
    const generateTextForBrainstorm = vi.fn().mockResolvedValue({
      text: "KEY PLAYERS:\n- Apple",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const result = await fetchArticleBrainstorm(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 800,
        messages: [{ role: "user", content: "article" }],
      },
      { generateTextForBrainstorm },
    );

    expect(result.text).toContain("Apple");
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });
});

describe("normalizeLlmExtractionWire", () => {
  it("maps empty description and NONE sentiment to null", () => {
    const out = normalizeLlmExtractionWire({
      entities: [
        {
          canonicalName: "Acme",
          typeId: TID,
          description: "",
          aliases: ["ACME"],
        },
      ],
      relations: [],
      articleMentions: [
        {
          entityName: "Acme",
          mentionCount: 1,
          confidence: 0.9,
          sentiment: "NONE",
        },
      ],
    });
    expect(out.entities[0]?.description).toBeNull();
    expect(out.articleMentions[0]?.sentiment).toBeNull();
  });

  it("preserves non-empty description and concrete sentiment", () => {
    const out = normalizeLlmExtractionWire({
      entities: [
        {
          canonicalName: "Acme",
          typeId: TID,
          description: "  HQ  ",
          aliases: [],
        },
      ],
      relations: [],
      articleMentions: [
        {
          entityName: "Acme",
          mentionCount: 1,
          confidence: 0.5,
          sentiment: "NEGATIVE",
        },
      ],
    });
    expect(out.entities[0]?.description).toBe("HQ");
    expect(out.articleMentions[0]?.sentiment).toBe("NEGATIVE");
  });
});

describe("applyRelationCritiqueDrops", () => {
  const REL_TYPE = "22222222-2222-4222-a222-222222222222";

  it("removes at most dropFraction of drop-flagged rows, lowest scores first", () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      fromEntityName: `From${String(index)}`,
      toEntityName: `To${String(index)}`,
      relationTypeId: REL_TYPE,
    }));

    const ratings = candidates.map((relation, index) => ({
      ...relation,
      textualSupport: index < 5 ? 1 : 5,
      correctnessOfType: index < 5 ? 1 : 5,
      novelty: index < 5 ? 1 : 5,
      drop: index < 5,
      evidenceSpan: `evidence ${String(index)}`,
    }));

    const result = applyRelationCritiqueDrops(candidates, ratings, 0.25);

    expect(result.droppedCount).toBe(2);
    expect(result.relations).toHaveLength(6);
    expect(result.relations.map((relation) => relation.fromEntityName)).toEqual(
      ["From2", "From3", "From4", "From5", "From6", "From7"],
    );
  });
});

describe("buildRelationCritiqueModelMessages", () => {
  it("includes vocabulary and numbered candidates in system and user turns", () => {
    const candidates = [
      {
        fromEntityName: "A",
        toEntityName: "B",
        relationTypeId: RID,
      },
    ];
    const messages = buildRelationCritiqueModelMessages(
      {
        relationTypes: [{ id: RID, name: "PART_OF", description: null }],
      },
      {
        articleTitle: "Headline",
        articleBody: "Full article body text.",
        candidates,
      },
    );

    expect(messages).toHaveLength(2);
    expect(String(messages[0]?.content)).toContain(RID);
    expect(String(messages[1]?.content)).toContain("Headline");
    expect(String(messages[1]?.content)).toContain("1. from=A");
  });
});

describe("buildRelationCritiqueSystemContent", () => {
  it("includes relation type ids from context", () => {
    const text = buildRelationCritiqueSystemContent({
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });
    expect(text).toContain(RID);
    expect(text).toContain("PART_OF");
  });
});

describe("buildRelationCritiqueUserContent", () => {
  it("includes title, body, and candidate list", () => {
    const text = buildRelationCritiqueUserContent({
      articleTitle: "T",
      articleBody: "Body",
      candidates: [
        {
          fromEntityName: "X",
          toEntityName: "Y",
          relationTypeId: RID,
        },
      ],
    });
    expect(text).toContain("T");
    expect(text).toContain("Body");
    expect(text).toContain("from=X");
  });
});

describe("repairExtractionVocabulary", () => {
  const badEntity = (
    canonicalName: string,
    typeId: string,
  ): BadEntityRecord => ({
    entity: { canonicalName, typeId, aliases: [] },
    reason: "unknown_typeId",
  });

  it("returns repaired entities when the repair call supplies valid UUIDs", async () => {
    const generateObjectForVocabularyRepair = vi.fn().mockResolvedValue({
      object: {
        entities: [
          {
            canonicalName: "Bad",
            typeId: TID,
            description: "",
            aliases: [],
          },
        ],
        relations: [],
      },
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
    });

    const result = await repairExtractionVocabulary(
      {
        apiKey: "sk-test",
        model: "gpt-test",
        maxOutputTokens: 512,
        ctx: {
          entityTypes: [{ id: TID, name: "Company", description: null }],
          relationTypes: [{ id: RID, name: "PART_OF", description: null }],
        },
        badEntities: [badEntity("Bad", "99999999-9999-4999-a999-999999999999")],
        badRelations: [],
      },
      { generateObjectForVocabularyRepair },
    );

    expect(result.entities).toEqual([
      { canonicalName: "Bad", typeId: TID, aliases: [] },
    ]);
    expect(generateObjectForVocabularyRepair).toHaveBeenCalledOnce();
  });
});

describe("vocabulary repair with partition (repair policy flow)", () => {
  const ctx = {
    entityTypes: [{ id: TID, name: "Company", description: null }],
    relationTypes: [{ id: RID, name: "PART_OF", description: null }],
  };

  it("merges okEntities with repaired badEntities when repair returns valid UUIDs", async () => {
    const entities = [
      { canonicalName: "Good1", typeId: TID, aliases: [] as string[] },
      { canonicalName: "Good2", typeId: TID, aliases: [] as string[] },
      {
        canonicalName: "Bad",
        typeId: "99999999-9999-4999-a999-999999999999",
        aliases: [] as string[],
      },
    ];
    const relations = [
      {
        fromEntityName: "Good1",
        toEntityName: "Good2",
        relationTypeId: RID,
      },
    ];

    const partitioned = partitionExtractionByVocabulary(
      entities,
      relations,
      ctx,
    );
    expect(partitioned.okEntities).toHaveLength(2);
    expect(partitioned.okRelations).toHaveLength(1);
    expect(partitioned.badRelations).toHaveLength(0);
    expect(partitioned.badEntities).toHaveLength(1);

    const repairResult = await repairExtractionVocabulary(
      {
        apiKey: "sk-test",
        model: "gpt-test",
        maxOutputTokens: 512,
        ctx,
        badEntities: partitioned.badEntities,
        badRelations: partitioned.badRelations,
      },
      {
        generateObjectForVocabularyRepair: vi.fn().mockResolvedValue({
          object: {
            entities: [
              {
                canonicalName: "Bad",
                typeId: TID,
                description: "",
                aliases: [],
              },
            ],
            relations: [],
          },
          usage: null,
        }),
      },
    );

    const repairedPartition = partitionExtractionByVocabulary(
      repairResult.entities,
      repairResult.relations,
      ctx,
    );
    const finalEntities = [
      ...partitioned.okEntities,
      ...repairedPartition.okEntities,
    ];

    expect(finalEntities).toHaveLength(3);
    expect(repairedPartition.okEntities).toHaveLength(1);
    expect(partitioned.badEntities.length).toBe(
      repairedPartition.okEntities.length,
    );
  });

  it("keeps only okEntities when the repair call throws", async () => {
    const partitioned = partitionExtractionByVocabulary(
      [
        { canonicalName: "Good", typeId: TID, aliases: [] },
        {
          canonicalName: "Bad",
          typeId: "99999999-9999-4999-a999-999999999999",
          aliases: [],
        },
      ],
      [],
      ctx,
    );

    await expect(
      repairExtractionVocabulary(
        {
          apiKey: "sk-test",
          model: "gpt-test",
          maxOutputTokens: 512,
          ctx,
          badEntities: partitioned.badEntities,
          badRelations: partitioned.badRelations,
        },
        {
          generateObjectForVocabularyRepair: vi
            .fn()
            .mockRejectedValue(new Error("repair down")),
        },
      ),
    ).rejects.toThrow("repair down");

    expect(partitioned.okEntities).toHaveLength(1);
    expect(partitioned.okEntities[0]?.canonicalName).toBe("Good");
  });
});

describe("vocabularyRepairPreservesIdentity", () => {
  it("rejects repair output that renames entities or relation endpoints", () => {
    expect(
      vocabularyRepairPreservesIdentity(
        [
          {
            entity: { canonicalName: "A", typeId: TID, aliases: [] },
            reason: "unknown_typeId",
          },
        ],
        [],
        { entities: [{ canonicalName: "Renamed" }], relations: [] },
      ),
    ).toBe(false);
  });
});

describe("buildVocabularyRepairSystemContent", () => {
  it("includes entity and relation vocabulary blocks", () => {
    const text = buildVocabularyRepairSystemContent({
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });
    expect(text).toContain(TID);
    expect(text).toContain(RID);
    expect(text).toContain("unchanged");
  });
});

describe("normalizeLlmUsageFromSdk", () => {
  it("returns null when all token fields are absent", () => {
    expect(normalizeLlmUsageFromSdk({})).toBeNull();
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      }),
    ).toBeNull();
  });

  it("coalesces partial usage into a numeric triple", () => {
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: undefined,
      }),
    ).toEqual({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
    });
  });

  it("respects explicit totalTokens", () => {
    expect(
      normalizeLlmUsageFromSdk({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 99,
      }),
    ).toEqual({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 99,
    });
  });
});

describe("classifyLlmExtractionError", () => {
  it("classifies APICallError with status 429 as transient", () => {
    const error = new APICallError({
      message: "rate limited",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: false,
    });

    expect(classifyLlmExtractionError(error)).toBe("transient");
  });

  it("classifies APICallError with status 503 as transient", () => {
    const error = new APICallError({
      message: "service unavailable",
      url: "https://api.openai.com",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: false,
    });

    expect(classifyLlmExtractionError(error)).toBe("transient");
  });

  it("classifies APICallError with isRetryable=true as transient regardless of status", () => {
    const error = new APICallError({
      message: "retryable error",
      url: "https://api.openai.com",
      requestBodyValues: {},
      isRetryable: true,
    });

    expect(classifyLlmExtractionError(error)).toBe("transient");
  });

  it("classifies NoObjectGeneratedError with no-response message as transient", () => {
    const error = new NoObjectGeneratedError({
      message: "No object generated: the model did not return a response.",
      response: {
        id: "test-id",
        modelId: "gpt-4o-mini",
        timestamp: new Date(),
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
      },
      finishReason: "stop",
    });

    expect(classifyLlmExtractionError(error)).toBe("transient");
  });

  it("classifies timeout message strings as transient", () => {
    expect(classifyLlmExtractionError(new Error("request timed out"))).toBe(
      "transient",
    );
    expect(classifyLlmExtractionError(new Error("ETIMEDOUT"))).toBe(
      "transient",
    );
    expect(classifyLlmExtractionError(new Error("ECONNRESET"))).toBe(
      "transient",
    );
  });

  it("classifies parse failure message as permanent", () => {
    expect(
      classifyLlmExtractionError(
        new Error("could not parse the response from OpenAI"),
      ),
    ).toBe("permanent");
  });

  it("classifies generic Error as permanent", () => {
    expect(classifyLlmExtractionError(new Error("unexpected error"))).toBe(
      "permanent",
    );
  });
});

type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other";

const noObjectGeneratedErrorFixture = (
  finishReason: FinishReason,
  text?: string,
): NoObjectGeneratedError =>
  new NoObjectGeneratedError({
    message: "No object generated: the model did not return a response.",
    response: {
      id: "test-id",
      modelId: "gpt-4o-mini",
      timestamp: new Date(),
    },
    usage: {
      inputTokens: 100,
      outputTokens: 8192,
      totalTokens: 8292,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
    },
    finishReason,
    ...(text !== undefined ? { text } : {}),
  });

describe("classifyNoResponseSubtype", () => {
  it("returns length_truncation for finishReason: length", () => {
    const error = noObjectGeneratedErrorFixture("length");

    expect(classifyNoResponseSubtype(error)).toBe("length_truncation");
  });

  it("returns content_filter for finishReason: content-filter", () => {
    const error = noObjectGeneratedErrorFixture("content-filter");

    expect(classifyNoResponseSubtype(error)).toBe("content_filter");
  });

  it("returns empty_stop for finishReason: stop", () => {
    const error = noObjectGeneratedErrorFixture("stop");

    expect(classifyNoResponseSubtype(error)).toBe("empty_stop");
  });

  it("returns empty_stop for unrecognized finishReason with empty text", () => {
    const error = noObjectGeneratedErrorFixture("other", "");

    expect(classifyNoResponseSubtype(error)).toBe("empty_stop");
  });

  it("returns other for a non-NoObjectGeneratedError", () => {
    expect(classifyNoResponseSubtype(new Error("parse failure"))).toBe("other");
  });

  it("returns other for a plain object", () => {
    expect(classifyNoResponseSubtype({ code: 500 })).toBe("other");
  });
});

describe("executeLlmCallWithTransientRetries", () => {
  it("resolves immediately when operation succeeds on first attempt", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockResolvedValue("ok");

    const result = await executeLlmCallWithTransientRetries(operation, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      sleep: fakeSleep,
      classify: () => "transient",
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledOnce();
    expect(fakeSleep).not.toHaveBeenCalled();
  });

  it("retries transient failures and resolves when the operation eventually succeeds", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const transientError = new Error("rate limited");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue("recovered");
    let retryCallCount = 0;

    const result = await executeLlmCallWithTransientRetries(operation, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      sleep: fakeSleep,
      classify: () => "transient",
      onRetry: () => {
        retryCallCount++;
      },
    });

    expect(result).toBe("recovered");
    expect(fakeSleep).toHaveBeenCalledTimes(2);
    expect(retryCallCount).toBe(2);
    const firstDelay = fakeSleep.mock.calls[0]?.[0] as number;
    const secondDelay = fakeSleep.mock.calls[1]?.[0] as number;
    expect(firstDelay).toBeGreaterThanOrEqual(0);
    expect(firstDelay).toBeLessThanOrEqual(100);
    expect(secondDelay).toBeGreaterThanOrEqual(0);
    expect(secondDelay).toBeLessThanOrEqual(200);
  });

  it("rethrows after exhausting maxRetries", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const transientError = new Error("still failing");
    const operation = vi.fn().mockRejectedValue(transientError);

    await expect(
      executeLlmCallWithTransientRetries(operation, {
        maxRetries: 1,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        sleep: fakeSleep,
        classify: () => "transient",
      }),
    ).rejects.toThrow("still failing");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(fakeSleep).toHaveBeenCalledTimes(1);
  });

  it("rethrows immediately without sleeping when classification is permanent", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const permanentError = new Error("could not parse");
    const operation = vi.fn().mockRejectedValue(permanentError);

    await expect(
      executeLlmCallWithTransientRetries(operation, {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        sleep: fakeSleep,
        classify: () => "permanent",
      }),
    ).rejects.toThrow("could not parse");

    expect(operation).toHaveBeenCalledOnce();
    expect(fakeSleep).not.toHaveBeenCalled();
  });

  it("stops retrying when shouldAbort returns true before sleep", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const transientError = new Error("transient");
    const operation = vi.fn().mockRejectedValue(transientError);
    const shouldAbort = vi.fn().mockReturnValue(true);

    await expect(
      executeLlmCallWithTransientRetries(operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        sleep: fakeSleep,
        classify: () => "transient",
        shouldAbort,
      }),
    ).rejects.toThrow("transient");

    expect(fakeSleep).not.toHaveBeenCalled();
  });

  it("delays are bounded by maxDelayMs", async () => {
    const fakeSleep = vi.fn().mockResolvedValue(undefined);
    const transientError = new Error("rate limited");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue("ok");

    await executeLlmCallWithTransientRetries(operation, {
      maxRetries: 3,
      baseDelayMs: 10000,
      maxDelayMs: 50,
      sleep: fakeSleep,
      classify: () => "transient",
    });

    for (const call of fakeSleep.mock.calls) {
      expect(call[0] as number).toBeLessThanOrEqual(50);
    }
  });
});
