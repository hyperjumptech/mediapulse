/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import { embedTexts } from "./embeddings";

vi.mock("ai", () => ({
  embedMany: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (modelId: string) => modelId),
}));

import { embedMany } from "ai";

describe("embedTexts", () => {
  it("returns an empty array without calling embedMany when texts is empty", async () => {
    const result = await embedTexts([], { apiKey: "sk-test" });

    expect(result).toEqual([]);
    expect(embedMany).not.toHaveBeenCalled();
  });
});
