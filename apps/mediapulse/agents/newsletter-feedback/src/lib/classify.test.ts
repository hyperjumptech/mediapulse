/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const generateObjectMock = vi.fn((_args: unknown) => undefined as unknown);
const openaiFactory = vi.fn((model: string) => ({ id: model }));
const createOpenAIMock = vi.fn((_options: unknown) => openaiFactory);

vi.mock("ai", () => ({
  generateObject: (args: unknown) => generateObjectMock(args),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: (options: unknown) => createOpenAIMock(options),
}));

import { classifyFeedback } from "./classify.js";

describe("classifyFeedback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds the provider with the api key and base url and returns the object", async () => {
    // Setup
    generateObjectMock.mockResolvedValue({
      object: { sentiment: "negative", category: "complaint" },
    });

    // Act
    const result = await classifyFeedback({
      apiKey: "sk-test",
      model: "gpt-test",
      baseUrl: "https://gateway.example.com/v1",
      replyText: "I did not like this at all.",
    });

    // Assert
    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://gateway.example.com/v1",
    });
    expect(openaiFactory).toHaveBeenCalledWith("gpt-test");
    expect(result).toEqual({ sentiment: "negative", category: "complaint" });
    const callArg = generateObjectMock.mock.calls[0]![0] as {
      messages: { role: string; content: string }[];
    };
    expect(callArg.messages[1]).toEqual({
      role: "user",
      content: "I did not like this at all.",
    });
  });

  it("omits baseURL when not provided", async () => {
    // Setup
    generateObjectMock.mockResolvedValue({
      object: { sentiment: "positive", category: "praise" },
    });

    // Act
    await classifyFeedback({
      apiKey: "sk-test",
      model: "gpt-test",
      replyText: "Great!",
    });

    // Assert
    expect(createOpenAIMock).toHaveBeenCalledWith({ apiKey: "sk-test" });
  });
});
