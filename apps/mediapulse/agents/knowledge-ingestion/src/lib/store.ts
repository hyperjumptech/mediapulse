import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import type {
  GetKnowledgeExtractionCandidatesResponse,
  KnowledgeExtractedEntity,
  KnowledgeExtractionRejection,
} from "@workspace/agent-data-api-contract";

/** Everything the extraction pass needs from storage. */
export type KnowledgeStore = {
  candidates: (query: {
    tickerId: string;
    since?: string;
    fromStart?: boolean;
    take?: number;
  }) => Promise<GetKnowledgeExtractionCandidatesResponse>;
  seedFromProfile: (input: {
    tickerId: string;
    extractionRunId: string | null;
  }) => Promise<{
    entitiesCreated: number;
    relationsOpened: number;
    relationsConfirmed: number;
  }>;
  apply: (input: {
    tickerId: string;
    dataSourceId: string;
    extractionRunId: string | null;
    entities: readonly KnowledgeExtractedEntity[];
    relations: readonly {
      subject: string;
      kind: string;
      object: string;
      evidenceSpan: string;
    }[];
  }) => Promise<{
    entitiesCreated: number;
    mentionsWritten: number;
    relationsOpened: number;
    relationsConfirmed: number;
    kindsCreated: number;
    rejected: KnowledgeExtractionRejection[];
  }>;
};

/**
 * Builds the storage port over the agent-data-api SDK.
 *
 * - Important: the server applies the same guards on every write, so this agent counts outcomes
 *   rather than deciding them and the two cannot drift.
 *
 * @param client - Typed agent-data-api client.
 */
export const createKnowledgeStore = (
  client: AgentDataApiClient,
): KnowledgeStore => ({
  candidates: async (query) =>
    client.knowledgeExtractionCandidates.get({
      tickerId: query.tickerId,
      since: query.since,
      fromStart: query.fromStart ?? false,
      take: query.take,
    }),

  seedFromProfile: async (input) =>
    client.knowledgeExtractionSeed.create({
      tickerId: input.tickerId,
      extractionRunId: input.extractionRunId,
    }),

  apply: async (input) =>
    client.knowledgeExtractions.create({
      tickerId: input.tickerId,
      dataSourceId: input.dataSourceId,
      extractionRunId: input.extractionRunId,
      entities: [...input.entities],
      relations: [...input.relations],
    }),
});
