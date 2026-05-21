/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedExemplar } from "./exemplars/default-extraction-exemplars.js";
import {
  buildExtractionModelMessages,
  buildExtractionSystemContent,
  buildExtractionUserContent,
  buildBrainstormFollowUpUserContent,
  buildBrainstormSystemContent,
  buildBrainstormUserContent,
  extractEntitiesAndRelationsForSource,
  fetchArticleBrainstorm,
  llmExtractionOpenAiWireSchema,
  normalizeLlmExtractionWire,
  normalizeLlmUsageFromSdk,
  parseArticleBrainstormText,
  resolveArticleAnalysisExtractionSystemContent,
  resolveArticleAnalysisExtractionUserContent,
} from "./llm-extract-entities.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("resolveArticleAnalysisExtractionSystemContent", () => {
  it("matches buildExtractionSystemContent when Hermes omits override", () => {
    const ctx = {
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    };

    // Act
    const resolved = resolveArticleAnalysisExtractionSystemContent(
      undefined,
      ctx,
    );
    const legacy = buildExtractionSystemContent(ctx);

    // Assert
    expect(resolved).toBe(legacy);
  });

  it("applies configured system template with placeholders", () => {
    const ctx = {
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    };
    const text = resolveArticleAnalysisExtractionSystemContent(
      "E:\n{{entityTypesBlock}}\nR:\n{{relationTypesBlock}}",
      ctx,
    );

    expect(text).toContain(TID);
    expect(text).toContain("E:");
    expect(text.startsWith("E:")).toBe(true);
  });
});

describe("resolveArticleAnalysisExtractionUserContent", () => {
  it("matches buildExtractionUserContent when Hermes omits override", () => {
    const args = {
      tickerId: "T",
      title: "Hello",
      contentTruncated: "Body text",
    };

    // Act
    const resolved = resolveArticleAnalysisExtractionUserContent(
      undefined,
      args,
    );
    const legacy = buildExtractionUserContent(args);

    // Assert
    expect(resolved).toBe(legacy);
  });

  it("uses custom user template with placeholders", () => {
    const u = resolveArticleAnalysisExtractionUserContent(
      "ID={{tickerId}} BODY={{articleContent}}",
      {
        tickerId: "ABC",
        title: "ignored",
        contentTruncated: "X",
      },
    );

    expect(u).toBe("ID=ABC BODY=X");
  });
});

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
      title: "Hello",
      contentTruncated: "Body text",
    });
    expect(u).toContain("T");
    expect(u).toContain("Hello");
    expect(u).toContain("Body text");
  });
});

describe("buildExtractionModelMessages", () => {
  const systemContent = "system prompt";
  const userContent = "real article user prompt";

  const exemplar = (
    id: string,
    snippet: string,
  ): ResolvedExemplar => ({
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
    expect(capturedMessages?.at(-1)?.content).toBe(
      buildBrainstormFollowUpUserContent(brainstormText),
    );
    expect(String(capturedMessages?.at(-1)?.content)).toContain("Apple");
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
      title: "Hello",
      contentTruncated: "Body text",
    };

    expect(buildBrainstormUserContent(args)).toBe(buildExtractionUserContent(args));
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
