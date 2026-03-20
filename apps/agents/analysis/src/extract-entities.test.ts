/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractEntities } from "./extract-entities";

describe("extractEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts entities/relations in batch mode", async () => {
    // Setup
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              articles: [
                {
                  articleId: "a1",
                  entities: [
                    {
                      name: "Bank Central Asia",
                      type: "ORG",
                      aliases: ["BBCA"],
                      description: "Large Indonesian bank",
                    },
                    {
                      name: "OJK",
                      type: "ORG",
                      aliases: [],
                      description: "Financial regulator",
                    },
                  ],
                  relations: [
                    {
                      from: "Bank Central Asia",
                      to: "OJK",
                      relationType: "REGULATED_BY",
                    },
                  ],
                },
                {
                  articleId: "a2",
                  entities: [
                    {
                      name: "Bank Central Asia",
                      type: "ORG",
                      aliases: ["PT BCA"],
                    },
                  ],
                  relations: [],
                },
              ],
            }),
          },
        },
      ],
    });
    const logger = { warn: vi.fn() };

    // Act
    const result = await extractEntities({
      dataSources: [
        {
          id: "a1",
          title: "Article 1",
          url: "https://example.com/a1",
          content: "Content 1",
        },
        {
          id: "a2",
          title: "Article 2",
          url: "https://example.com/a2",
          content: "Content 2",
        },
      ],
      entityTypes: [{ id: "et-org", name: "ORG", description: null }],
      relationTypes: [
        {
          id: "rt-reg",
          name: "REGULATED_BY",
          description: null,
        },
      ],
      openAiConfig: {
        apiKey: "test-openai-api-key",
        model: "gpt-4o-mini",
      },
      openAiClient: {
        chat: {
          completions: { create },
        },
      },
      logger,
      batchSize: 4,
    });

    // Assert
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.entities).toHaveLength(2);
    expect(result.relations).toEqual([
      {
        fromEntityName: "Bank Central Asia",
        toEntityName: "OJK",
        relationTypeId: "rt-reg",
      },
    ]);
    expect(result.articleEntities).toHaveLength(3);
    expect(result.failedArticleIds).toEqual([]);
    expect(result.articleEntityNamesByDataSourceId.a1).toEqual([
      "Bank Central Asia",
      "OJK",
    ]);
  });

  it("retries single articles when a batch call fails", async () => {
    // Setup
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("batch boom"))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                articles: [
                  {
                    articleId: "b1",
                    entities: [{ name: "BBCA", type: "ORG", aliases: [] }],
                    relations: [],
                  },
                ],
              }),
            },
          },
        ],
      })
      .mockRejectedValueOnce(new Error("article failed"));
    const logger = { warn: vi.fn() };

    // Act
    const result = await extractEntities({
      dataSources: [
        {
          id: "b1",
          title: "Article B1",
          url: "https://example.com/b1",
          content: "B1",
        },
        {
          id: "b2",
          title: "Article B2",
          url: "https://example.com/b2",
          content: "B2",
        },
      ],
      entityTypes: [{ id: "et-org", name: "ORG", description: null }],
      relationTypes: [],
      openAiConfig: {
        apiKey: "test-openai-api-key",
        model: "gpt-4o-mini",
      },
      openAiClient: {
        chat: {
          completions: { create },
        },
      },
      logger,
      batchSize: 4,
    });

    // Assert
    expect(create).toHaveBeenCalledTimes(3);
    expect(result.failedArticleIds).toEqual(["b2"]);
    expect(result.articleEntityNamesByDataSourceId.b1).toEqual(["BBCA"]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("skips unknown entity and relation vocab values", async () => {
    // Setup
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              articles: [
                {
                  articleId: "c1",
                  entities: [
                    { name: "Known Org", type: "ORG", aliases: [] },
                    { name: "Unknown Person", type: "PERSON", aliases: [] },
                  ],
                  relations: [
                    {
                      from: "Known Org",
                      to: "Unknown Person",
                      relationType: "RELATED_TO",
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    });
    const logger = { warn: vi.fn() };

    // Act
    const result = await extractEntities({
      dataSources: [
        {
          id: "c1",
          title: "Article C1",
          url: "https://example.com/c1",
          content: "C1",
        },
      ],
      entityTypes: [{ id: "et-org", name: "ORG", description: null }],
      relationTypes: [],
      openAiConfig: {
        apiKey: "test-openai-api-key",
        model: "gpt-4o-mini",
      },
      openAiClient: {
        chat: {
          completions: { create },
        },
      },
      logger,
      batchSize: 4,
    });

    // Assert
    expect(result.entities).toEqual([
      {
        canonicalName: "Known Org",
        typeId: "et-org",
        description: undefined,
        aliases: ["Known Org"],
      },
    ]);
    expect(result.relations).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });
});
