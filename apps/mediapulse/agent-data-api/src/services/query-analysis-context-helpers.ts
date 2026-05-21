import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

type KgNeighborhoodRow = {
  fromEntity: string;
  relationType: string;
  toEntity: string;
};

/** Maximum sector/industry peers returned in GET context. */
export const QUERY_ANALYSIS_PEER_LIMIT = 5;

/** Maximum headline samples returned in GET context. */
export const QUERY_ANALYSIS_HEADLINE_LIMIT = 5;

/** Maximum KG neighborhood edges returned in GET context. */
export const QUERY_ANALYSIS_KG_NEIGHBORHOOD_LIMIT = 30;

/** Per-entity cap when sampling one-hop KG relations. */
export const QUERY_ANALYSIS_KG_RELATIONS_PER_ENTITY = 3;

/** Rolling window for calendar event-type sampling (days). */
export const QUERY_ANALYSIS_CALENDAR_EVENT_DAYS = 30;

type TickerMetadataRecord = Record<string, unknown>;

/**
 * Reads the first non-empty string from metadata for the given keys.
 *
 * @param metadata - Ticker or data-source JSON metadata.
 * @param keys - Candidate field names in priority order.
 * @returns Trimmed string value, or `undefined` when absent.
 */
export const pickMetadataString = (
  metadata: unknown,
  keys: string[],
): string | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const record = metadata as TickerMetadataRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

/**
 * Extracts sector and industry labels from ticker metadata (IDX or admin keys).
 *
 * @param metadata - Ticker JSON metadata.
 * @returns Sector/industry strings when present.
 */
export const extractTickerSectorIndustry = (
  metadata: unknown,
): { sector?: string; industry?: string } => ({
  sector: pickMetadataString(metadata, ["Sektor", "sector"]),
  industry: pickMetadataString(metadata, ["Industri", "industry"]),
});

/**
 * Parses market-cap style numeric metadata for peer ordering.
 *
 * @param metadata - Ticker JSON metadata.
 * @returns Numeric market cap, or `null` when unavailable.
 */
export const extractMarketCap = (metadata: unknown): number | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as TickerMetadataRecord;
  for (const key of ["marketCap", "MarketCap", "market_cap"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

/**
 * Builds Prisma `OR` filters for sector/industry peer lookup on JSON metadata.
 *
 * @param sector - Sector label from the anchor ticker.
 * @param industry - Industry label from the anchor ticker.
 * @returns Prisma-compatible OR clauses, or `undefined` when both are absent.
 */
export const buildPeerMetadataOrFilters = (
  sector: string | undefined,
  industry: string | undefined,
): Array<Record<string, unknown>> | undefined => {
  const filters: Array<Record<string, unknown>> = [];
  if (sector) {
    filters.push({ metadata: { path: ["Sektor"], equals: sector } });
    filters.push({ metadata: { path: ["sector"], equals: sector } });
  }
  if (industry) {
    filters.push({ metadata: { path: ["Industri"], equals: industry } });
    filters.push({ metadata: { path: ["industry"], equals: industry } });
  }
  return filters.length > 0 ? filters : undefined;
};

/**
 * Sorts peer ticker rows by market cap descending, then id ascending.
 *
 * @param peers - Candidate peer rows with metadata.
 * @returns Sorted peers capped at {@link QUERY_ANALYSIS_PEER_LIMIT}.
 */
export const sortAndLimitPeers = <
  T extends { id: string; symbol: string; name: string; metadata: unknown },
>(
  peers: T[],
): T[] =>
  [...peers]
    .sort((left, right) => {
      const leftCap = extractMarketCap(left.metadata);
      const rightCap = extractMarketCap(right.metadata);
      if (leftCap !== null && rightCap !== null) {
        return rightCap - leftCap;
      }
      if (leftCap !== null) {
        return -1;
      }
      if (rightCap !== null) {
        return 1;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, QUERY_ANALYSIS_PEER_LIMIT);

/**
 * Assigns descending relevance weights for ordered peer rows.
 *
 * @param peers - Ordered peer rows.
 * @returns Peer DTOs with relevance scores.
 */
export const mapPeersWithRelevance = (
  peers: Array<{ symbol: string; name: string }>,
): GetQueryAnalysisResponse["peers"] =>
  peers.map((peer, index) => ({
    symbol: peer.symbol,
    name: peer.name,
    relevance: Math.max(0.1, 1 - index * 0.1),
  }));

/**
 * Derives a display source name from a data-source URL.
 *
 * @param url - Article URL.
 * @returns Hostname without a leading `www.` segment.
 */
export const sourceNameFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * Resolves headline publish time from metadata or ingestion timestamp.
 *
 * @param metadata - Data-source JSON metadata.
 * @param createdAt - Row creation timestamp.
 * @returns ISO-8601 publish timestamp string.
 */
export const resolveHeadlinePublishedAt = (
  metadata: unknown,
  createdAt: Date,
): string => {
  const fromMetadata = pickMetadataString(metadata, [
    "publishedAt",
    "published_at",
    "fetchedAt",
  ]);
  if (fromMetadata) {
    const parsed = new Date(fromMetadata);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return createdAt.toISOString();
};

/**
 * Extracts an event-type label from data-source metadata.
 *
 * @param metadata - Data-source JSON metadata.
 * @returns Event type string, or `undefined` when absent.
 */
export const extractEventTypeFromMetadata = (
  metadata: unknown,
): string | undefined =>
  pickMetadataString(metadata, ["eventType", "event_type", "type"]);

/**
 * Collects unique recent event types from data-source metadata rows.
 *
 * @param rows - Recent data sources within the calendar window.
 * @returns De-duplicated event types in first-seen order.
 */
export const collectRecentEventTypes = (
  rows: Array<{ metadata: unknown }>,
): string[] => {
  const seen = new Set<string>();
  const eventTypes: string[] = [];
  for (const row of rows) {
    const eventType = extractEventTypeFromMetadata(row.metadata);
    if (!eventType || seen.has(eventType)) {
      continue;
    }
    seen.add(eventType);
    eventTypes.push(eventType);
  }
  return eventTypes;
};

type EntityRelationRow = {
  fromEntity: { canonicalName: string };
  toEntity: { canonicalName: string };
  relationType: { name: string };
};

/**
 * Samples up to three one-hop relations per top entity, deduped and capped globally.
 *
 * @param entityIds - Top entity ids ordered by relevance.
 * @param relations - Candidate one-hop relations including entity/type names.
 * @returns Flattened neighborhood edges.
 */
export const buildKgNeighborhood = (
  entityIds: string[],
  relations: Array<
    EntityRelationRow & { fromEntityId: string; toEntityId: string }
  >,
): KgNeighborhoodRow[] => {
  const seen = new Set<string>();
  const neighborhood: KgNeighborhoodRow[] = [];

  for (const entityId of entityIds) {
    let addedForEntity = 0;
    for (const relation of relations) {
      if (
        relation.fromEntityId !== entityId &&
        relation.toEntityId !== entityId
      ) {
        continue;
      }
      const tripleKey = `${relation.fromEntity.canonicalName}|${relation.relationType.name}|${relation.toEntity.canonicalName}`;
      if (seen.has(tripleKey)) {
        continue;
      }
      seen.add(tripleKey);
      neighborhood.push({
        fromEntity: relation.fromEntity.canonicalName,
        relationType: relation.relationType.name,
        toEntity: relation.toEntity.canonicalName,
      });
      addedForEntity += 1;
      if (
        neighborhood.length >= QUERY_ANALYSIS_KG_NEIGHBORHOOD_LIMIT ||
        addedForEntity >= QUERY_ANALYSIS_KG_RELATIONS_PER_ENTITY
      ) {
        break;
      }
    }
    if (neighborhood.length >= QUERY_ANALYSIS_KG_NEIGHBORHOOD_LIMIT) {
      break;
    }
  }

  return neighborhood;
};
