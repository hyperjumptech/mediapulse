import { describe, expect, it, vi } from "vitest";
import { generateLlmQueries } from "./llm-generator.js";
import type { TickerContext } from "./deterministic-generator.js";

const ticker: TickerContext = {
  symbol: "AAPL",
  name: "Apple Inc.",
  topEntities: [{ canonicalName: "Tim Cook", typeName: "Person" }],
  recentThemes:  [{ theme: "iPhone" }],
};

const makeOpenAi = (content: string | null) =>
  ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  }) as never;

describe("generateLlmQueries", () => {
  it("returns parsed queries on valid JSON array response", async () => {
    const payload = JSON.stringify([
      { text: "Apple earnings beat", intent: "fundamental" },
      { text: "Tim Cook interview", intent: "breaking" },
    ]);
    const openai = makeOpenAi(payload);

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.text).toBe("Apple earnings beat");
    expect(result[0]!.intent).toBe("fundamental");
  });

  it("unwraps array from object wrapper (json_object response format)", async () => {
    const payload = JSON.stringify({
      queries: [{ text: "Apple partnership news", intent: "kg_change" }],
    });
    const openai = makeOpenAi(payload);

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.intent).toBe("kg_change");
  });

  it("returns empty array when LLM returns null content", async () => {
    const openai = makeOpenAi(null);

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(0);
  });

  it("returns empty array when LLM throws", async () => {
    const openai = {
      chat: { completions: { create: vi.fn().mockRejectedValue(new Error("network error")) } },
    } as never;

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(0);
  });

  it("returns empty array when response is not parseable JSON", async () => {
    const openai = makeOpenAi("not valid json {{");

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(0);
  });

  it("returns empty array when schema validation fails (invalid intent)", async () => {
    const payload = JSON.stringify([{ text: "test", intent: "INVALID_INTENT" }]);
    const openai = makeOpenAi(payload);

    const result = await generateLlmQueries(ticker, [], {
      openai,
      model: "gpt-4o-mini",
      maxTokens: 512,
      targetCount: 5,
    });

    expect(result).toHaveLength(0);
  });
});
