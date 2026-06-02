/** @vitest-environment node */

import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { describe, expect, it } from "vitest";

import {
  buildArticleAnalysisExtractionSystemContent,
  buildArticleAnalysisExtractionUserContent,
} from "./llm-extract-entities.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("agent prompt fingerprinting (REQ-011)", () => {
  it("is stable for the same vocabulary and user args", () => {
    const ctx = {
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    };
    const userArgs = {
      tickerId: "t-1",
      tickerSymbol: "T1",
      tickerName: "Ticker One",
      title: "Title",
      contentTruncated: "Body",
    };
    const sys = buildArticleAnalysisExtractionSystemContent(ctx);
    const user = buildArticleAnalysisExtractionUserContent(userArgs);

    const fpA = computeLlmPromptFingerprint(sys, user);
    const fpB = computeLlmPromptFingerprint(
      buildArticleAnalysisExtractionSystemContent(ctx),
      buildArticleAnalysisExtractionUserContent(userArgs),
    );

    expect(fpA).toBe(fpB);
  });

  it("differs when analysis GET vocabulary differs but user args match", () => {
    const userArgs = {
      tickerId: "t-1",
      tickerSymbol: "T1",
      tickerName: "Ticker One",
      title: "Title",
      contentTruncated: "Body",
    };
    const user = buildArticleAnalysisExtractionUserContent(userArgs);
    const sysA = buildArticleAnalysisExtractionSystemContent({
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });
    const sysB = buildArticleAnalysisExtractionSystemContent({
      entityTypes: [
        {
          id: "33333333-3333-4333-a333-333333333333",
          name: "Person",
          description: null,
        },
      ],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    });

    const fpA = computeLlmPromptFingerprint(sysA, user);
    const fpB = computeLlmPromptFingerprint(sysB, user);

    expect(fpA).not.toBe(fpB);
  });
});
