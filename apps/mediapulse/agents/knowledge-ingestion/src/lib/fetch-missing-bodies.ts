import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  CONTENT_GENERATION_FETCH_EVENTS_MAX,
  CONTENT_GENERATION_FETCHED_CONTENT_MAX,
  type OrganonIngestionCandidate,
} from "@workspace/agent-data-api-contract";
import {
  fetchSourceBodies,
  newsletterExclusionOf,
  type FetchSourceBodiesConfig,
  type WebFetchLogger,
} from "@workspace/agent-ingestion";

import { chunked } from "./chunked.js";

export const FETCH_REASON = "knowledge_ingestion";

export type BodyDataApi = Pick<
  AgentDataApiClient,
  | "contentGenerationFetchedContent"
  | "contentGenerationFetchEvents"
  | "dataCollectionDeadUrlsLookup"
  | "dataCollectionDeadUrlsRecord"
>;

export type MissingBodiesResult = {
  bodies: Map<string, string>;
  excludedUrls: string[];
  fetchAttempted: number;
  fetched: number;
};

const hasBody = (content: string | null): content is string =>
  content !== null && content.trim() !== "";

const groupByFirstTicker = (
  candidates: readonly OrganonIngestionCandidate[],
): Map<string, OrganonIngestionCandidate[]> => {
  const groups = new Map<string, OrganonIngestionCandidate[]>();
  for (const candidate of candidates) {
    const tickerId = candidate.tickers[0]?.id;
    if (tickerId) {
      groups.set(tickerId, [...(groups.get(tickerId) ?? []), candidate]);
    }
  }

  return groups;
};

export const fetchMissingBodies = async ({
  candidates,
  config,
  dataApi,
  fetchBodies = fetchSourceBodies,
  logger,
}: {
  candidates: readonly OrganonIngestionCandidate[];
  config: FetchSourceBodiesConfig;
  dataApi: BodyDataApi;
  fetchBodies?: typeof fetchSourceBodies;
  logger?: WebFetchLogger;
}): Promise<MissingBodiesResult> => {
  const bodies = new Map<string, string>();
  const excludedUrls: string[] = [];
  const missing: OrganonIngestionCandidate[] = [];
  for (const candidate of candidates) {
    if (hasBody(candidate.content)) {
      bodies.set(candidate.canonicalUrl, candidate.content);
    } else if (newsletterExclusionOf(candidate.url) !== undefined) {
      excludedUrls.push(candidate.canonicalUrl);
    } else {
      missing.push(candidate);
    }
  }

  let fetchAttempted = 0;
  let fetched = 0;
  for (const [tickerId, group] of groupByFirstTicker(missing)) {
    const budget = config.maxFetches - fetchAttempted;
    if (budget <= 0) {
      break;
    }
    const result = await fetchBodies(
      group.map((candidate) => ({
        dataSourceId: candidate.dataSourceId,
        url: candidate.url,
        title: candidate.title,
        sectionScore: candidate.sectionScore,
        reason: FETCH_REASON,
      })),
      { ...config, maxFetches: budget },
      { tickerId, ...(logger ? { logger } : {}) },
      {
        persistFetchedContent: async (body) => {
          let updatedCount = 0;
          for (const chunk of chunked(
            body,
            CONTENT_GENERATION_FETCHED_CONTENT_MAX,
          )) {
            const result =
              await dataApi.contentGenerationFetchedContent.create(chunk);
            updatedCount += result.updatedCount;
          }

          return { updatedCount };
        },
        lookupDeadUrls: (body) =>
          dataApi.dataCollectionDeadUrlsLookup.create(body),
        recordDeadUrls: (body) =>
          dataApi.dataCollectionDeadUrlsRecord.create(body),
      },
    );
    fetchAttempted += result.counters.attempted;

    for (const candidate of group) {
      const body = result.fetchedContentById.get(candidate.dataSourceId);
      if (body && hasBody(body.content)) {
        bodies.set(candidate.canonicalUrl, body.content);
        fetched += 1;
      }
    }

    const events = result.fetchEvents.map((event) => ({
      dataSourceId: event.dataSourceId,
      tickerId,
      reason: event.reason,
      ...(event.provider !== null ? { provider: event.provider } : {}),
      status: event.status,
    }));
    for (const chunk of chunked(events, CONTENT_GENERATION_FETCH_EVENTS_MAX)) {
      try {
        await dataApi.contentGenerationFetchEvents.create(chunk);
      } catch (error) {
        logger?.warn(
          { tickerId, err: error },
          "Failed to record fetch events (best-effort, skipping)",
        );
      }
    }
  }

  return { bodies, excludedUrls, fetchAttempted, fetched };
};
