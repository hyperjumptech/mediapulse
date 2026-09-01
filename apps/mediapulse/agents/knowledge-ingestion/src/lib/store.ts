import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import { KNOWLEDGE_ANCHOR_LOOKUP_MAX } from "@workspace/agent-data-api-contract";
import type { KnowledgeStorylineSnapshot } from "@workspace/agent-data-api-contract";

import type { StorylineSnapshot } from "./attach.js";
import type { KnowledgeStore } from "./ingest.js";

type Client = AgentDataApiClient;

const toSnapshot = (
  storyline: KnowledgeStorylineSnapshot,
): StorylineSnapshot => ({
  id: storyline.id,
  anchors: new Set(storyline.anchors),
  tickerCount: storyline.tickerCount,
  locked: storyline.locked,
  developments: storyline.developments.map((development) => ({
    id: development.id,
    anchors: new Set(development.anchors),
    titleAnchors: new Set(development.titleAnchors),
    figures: new Set(development.figures),
    day: development.day ?? undefined,
  })),
});

/**
 * Builds the storage port over the agent-data-api SDK.
 *
 * @param client - Typed agent-data-api client.
 * @param ingestionRunId - Run that every write is attributed to.
 */
export const createKnowledgeStore = (
  client: Client,
  ingestionRunId: string | null,
): KnowledgeStore => ({
  findStorylinesByAnchors: async (anchors) => {
    const response = await client.knowledgeStorylineCandidates.create({
      anchors: [...anchors].slice(0, KNOWLEDGE_ANCHOR_LOOKUP_MAX),
    });

    return response.storylines.map(toSnapshot);
  },

  openStoryline: async (command) =>
    client.knowledgeStorylines.create({
      name: command.name,
      title: command.title,
      observedAt: command.observedAt,
      anchors: [...command.anchors],
      titleAnchors: [...command.titleAnchors],
      figures: [...command.figures],
      dataSourceId: command.dataSourceId,
      tickerIds: [...command.tickerIds],
      ingestionRunId,
    }),

  openDevelopment: async (command) =>
    client.knowledgeDevelopments.create({
      storylineId: command.storylineId,
      title: command.title,
      observedAt: command.observedAt,
      anchors: [...command.anchors],
      titleAnchors: [...command.titleAnchors],
      figures: [...command.figures],
      dataSourceId: command.dataSourceId,
      tickerIds: [...command.tickerIds],
      ingestionRunId,
      evidence: command.evidence,
    }),

  cite: async (command) =>
    client.knowledgeDevelopmentCitations.create({
      storylineId: command.storylineId,
      developmentId: command.developmentId,
      dataSourceId: command.dataSourceId,
      tickerIds: [...command.tickerIds],
      observedAt: command.observedAt,
      anchors: [...command.anchors],
    }),
});
