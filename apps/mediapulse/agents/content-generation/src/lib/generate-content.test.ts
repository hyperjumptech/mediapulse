import { afterEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";

import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  generateContentWithOpenAI,
} from "./generate-content.js";
import type { SourceForGeneration } from "../types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const makeSource = (title: string, content: string): SourceForGeneration => ({
  url: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
  title,
  content,
});

const makeOpenAIMock = (topNews: Array<{ title: string; summary: string }>) => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            subject: "Daily Brief",
            executiveSummary: "Markets moved on key macro data.",
            topNews,
          }),
        },
      },
    ],
  });
  return {
    openai: {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI,
    mockCreate,
  };
};

describe("generateContentWithOpenAI", () => {
  it("topNewsCount=5 interpolates count into system and user prompts and slices topNews to 5", async () => {
    const topNewsItems = [
      { title: "Story 1", summary: "Summary 1." },
      { title: "Story 2", summary: "Summary 2." },
      { title: "Story 3", summary: "Summary 3." },
      { title: "Story 4", summary: "Summary 4." },
      { title: "Story 5", summary: "Summary 5." },
    ];
    const { openai, mockCreate } = makeOpenAIMock(topNewsItems);
    const sources = [makeSource("Source A", "Content about markets.")];

    const result = await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 5,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
    });

    const { messages } = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = messages[0]!.content;
    const userMsg = messages[1]!.content;

    // {{topNewsCount}} replaced with "5" in both prompts
    expect(systemMsg).toContain("5");
    expect(userMsg).toContain("5");
    // hardcoded "3" must not appear as the count in the default prompts
    expect(systemMsg).not.toMatch(/exactly 3 items/);
    expect(userMsg).not.toMatch(/top 3 news items/);

    // slice(0, 5) preserved all 5 items; formatted output reflects topNewsCount=5
    expect(result.content).toContain("TOP 5 NEWS");
    expect(result.content).toContain("5. Story 5");
  });

  it("slice(0, topNewsCount) clips the topNews list to the configured count", async () => {
    // LLM returns exactly topNewsCount=2 items — slice keeps both intact.
    const { openai } = makeOpenAIMock([
      { title: "Item 1", summary: "A." },
      { title: "Item 2", summary: "B." },
    ]);
    const sources = [makeSource("S", "content")];

    const result = await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 2,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
    });

    expect(result.content).toContain("TOP 2 NEWS");
    expect(result.content).toContain("1. Item 1");
    expect(result.content).toContain("2. Item 2");
    expect(result.content).not.toContain("3.");
  });

  it("uses default system prompt and user prompt template when none provided", async () => {
    const { openai, mockCreate } = makeOpenAIMock([
      { title: "A", summary: "a." },
    ]);
    const sources = [makeSource("T", "Source body text.")];

    await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 3,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
    });

    const { messages } = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = messages[0]!.content;
    const userMsg = messages[1]!.content;

    // default system prompt with 3 substituted
    expect(systemMsg).toContain("exactly 3 items");
    // default user prompt with 3 substituted and source content interpolated
    expect(userMsg).toContain("top 3 news items");
    expect(userMsg).toContain("Source body text.");
  });

  it("uses custom systemPrompt from config when provided", async () => {
    const { openai, mockCreate } = makeOpenAIMock([
      { title: "A", summary: "a." },
    ]);
    const sources = [makeSource("T", "content")];

    await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 3,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
      systemPrompt: "Custom system: give me {{topNewsCount}} items.",
    });

    const { messages } = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(messages[0]!.content).toBe("Custom system: give me 3 items.");
  });

  it("substitutes {{tickerId}} and {{date}} in custom prompt templates", async () => {
    const { openai, mockCreate } = makeOpenAIMock([
      { title: "A", summary: "a." },
    ]);
    const sources = [makeSource("T", "content")];

    await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 3,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
      userPromptTemplate:
        "Ticker: {{tickerId}} | Date: {{date}} | Count: {{topNewsCount}}\n\n{{sourceSummaries}}",
      tickerId: "BBCA",
      date: "2026-04-16",
    });

    const { messages } = mockCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMsg = messages[1]!.content;

    expect(userMsg).toContain("Ticker: BBCA");
    expect(userMsg).toContain("Date: 2026-04-16");
    expect(userMsg).toContain("Count: 3");
    expect(userMsg).not.toContain("{{tickerId}}");
    expect(userMsg).not.toContain("{{date}}");
  });

  it("returns subject, content, and description from the validated response", async () => {
    const { openai } = makeOpenAIMock([{ title: "A", summary: "a." }]);
    const sources = [makeSource("T", "content")];

    const result = await generateContentWithOpenAI(sources, {
      openai,
      model: "gpt-4o-mini",
      topNewsCount: 3,
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
    });

    expect(result.subject).toBe("Daily Brief");
    expect(result.content).toContain("EXECUTIVE SUMMARY");
    expect(result.description).toBe("Markets moved on key macro data.");
  });

  it("throws when OpenAI returns an empty response", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: null } }],
    });
    const openai = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;
    const sources = [makeSource("T", "content")];

    await expect(
      generateContentWithOpenAI(sources, {
        openai,
        model: "gpt-4o-mini",
        topNewsCount: 3,
        maxCharsPerSource: 8000,
        maxTotalContextChars: 100000,
      }),
    ).rejects.toThrow("OpenAI returned an empty response");
  });

  it("exports DEFAULT_SYSTEM_PROMPT with {{topNewsCount}} placeholder", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("{{topNewsCount}}");
  });

  it("exports DEFAULT_USER_PROMPT_TEMPLATE with {{topNewsCount}} and {{sourceSummaries}} placeholders", () => {
    expect(DEFAULT_USER_PROMPT_TEMPLATE).toContain("{{topNewsCount}}");
    expect(DEFAULT_USER_PROMPT_TEMPLATE).toContain("{{sourceSummaries}}");
  });
});
