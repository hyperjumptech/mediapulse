import { describe, expect, it, vi } from "vitest";
import { KNOWLEDGE_ANCHOR_LOOKUP_MAX } from "@workspace/agent-data-api-contract";
import type { AgentDataApiClient } from "@workspace/agent-data-api-client";

import { createKnowledgeStore } from "./store.js";

const createClient = () => {
  const create = vi.fn(async () => ({ storylines: [] }));

  return {
    client: {
      knowledgeStorylineCandidates: { create },
    } as unknown as AgentDataApiClient,
    create,
  };
};

describe("createKnowledgeStore", () => {
  it("never asks for more anchors than the lookup accepts", async () => {
    const { client, create } = createClient();
    const store = createKnowledgeStore(client, "run-1");
    const anchors = Array.from(
      { length: KNOWLEDGE_ANCHOR_LOOKUP_MAX + 131 },
      (_, index) => `anchor${index}`,
    );

    await store.findStorylinesByAnchors(anchors);

    expect(create).toHaveBeenCalledWith({
      anchors: anchors.slice(0, KNOWLEDGE_ANCHOR_LOOKUP_MAX),
    });
  });

  it("passes a short anchor list through unchanged", async () => {
    const { client, create } = createClient();
    const store = createKnowledgeStore(client, "run-1");

    await store.findStorylinesByAnchors(["telkom", "streamlining"]);

    expect(create).toHaveBeenCalledWith({
      anchors: ["telkom", "streamlining"],
    });
  });
});
