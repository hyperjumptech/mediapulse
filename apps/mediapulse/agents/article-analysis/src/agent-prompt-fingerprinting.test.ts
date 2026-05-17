/** @vitest-environment node */

import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { describe, expect, it } from "vitest";

import {
  resolveArticleAnalysisExtractionSystemContent,
  resolveArticleAnalysisExtractionUserContent,
} from "./llm-extract-entities.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("agent prompt fingerprinting (REQ-011)", () => {
  it("differs when Hermes system prompt override differs but user and context match", () => {
    const ctx = {
      entityTypes: [{ id: TID, name: "Company", description: null }],
      relationTypes: [{ id: RID, name: "PART_OF", description: null }],
    };
    const userArgs = {
      tickerId: "t-1",
      title: "Title",
      contentTruncated: "Body",
    };
    const user = resolveArticleAnalysisExtractionUserContent(
      undefined,
      userArgs,
    );
    const sysA = resolveArticleAnalysisExtractionSystemContent(undefined, ctx);
    const sysB = resolveArticleAnalysisExtractionSystemContent(
      "Custom intro\n\nENTITY TYPES (uuid — label):\n{{entityTypesBlock}}\n\nRELATION TYPES (uuid — label):\n{{relationTypesBlock}}",
      ctx,
    );

    // Act
    const fpA = computeLlmPromptFingerprint(sysA, user);
    const fpB = computeLlmPromptFingerprint(sysB, user);

    // Assert
    expect(fpA).not.toBe(fpB);
  });
});
