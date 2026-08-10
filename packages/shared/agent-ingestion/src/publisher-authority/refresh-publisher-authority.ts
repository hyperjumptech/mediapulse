import {
  PUBLISHER_AUTHORITY_LOOKUP_MAX,
  type PostPublisherAuthorityBody,
  type PostPublisherAuthorityResponse,
  type PostPublisherAuthorityStaleBody,
  type PostPublisherAuthorityStaleResponse,
} from "@workspace/agent-data-api-contract";

import {
  fetchOpenPageRank,
  OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST,
} from "./open-page-rank";

export type LookupStalePublisherAuthority = (
  body: PostPublisherAuthorityStaleBody,
) => Promise<PostPublisherAuthorityStaleResponse>;

export type RecordPublisherAuthority = (
  body: PostPublisherAuthorityBody,
) => Promise<PostPublisherAuthorityResponse>;

export type PublisherAuthorityRefreshLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
};

export type RefreshPublisherAuthorityOptions = {
  domains: readonly string[];
  apiKey: string;
  ttlDays: number;
  lookupStale: LookupStalePublisherAuthority;
  recordAuthority: RecordPublisherAuthority;
  logger?: PublisherAuthorityRefreshLogger;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type RefreshPublisherAuthorityResult = {
  requested: number;
  stale: number;
  scored: number;
  unscored: number;
  failed: number;
  skipped: boolean;
  domainsRemaining: number | null;
};

export async function refreshPublisherAuthority({
  domains,
  apiKey,
  ttlDays,
  lookupStale,
  recordAuthority,
  logger,
  baseUrl,
  fetchImpl,
}: RefreshPublisherAuthorityOptions): Promise<RefreshPublisherAuthorityResult> {
  const unique = [...new Set(domains.filter((domain) => domain !== ""))];
  const empty: RefreshPublisherAuthorityResult = {
    requested: unique.length,
    stale: 0,
    scored: 0,
    unscored: 0,
    failed: 0,
    skipped: false,
    domainsRemaining: null,
  };

  if (unique.length === 0) {
    return empty;
  }

  if (apiKey.trim() === "") {
    logger?.info(
      { requested: unique.length },
      "publisher authority refresh skipped: no api key configured",
    );

    return { ...empty, skipped: true };
  }

  let stale: string[] = [];
  try {
    for (
      let index = 0;
      index < unique.length;
      index += PUBLISHER_AUTHORITY_LOOKUP_MAX
    ) {
      const chunk = unique.slice(index, index + PUBLISHER_AUTHORITY_LOOKUP_MAX);
      const response = await lookupStale({ domains: chunk, ttlDays });
      stale.push(...response.domains);
    }
  } catch (error) {
    logger?.warn(
      { err: error, requested: unique.length },
      "publisher authority stale lookup failed; continuing",
    );

    return { ...empty, failed: unique.length };
  }

  stale = [...new Set(stale)];
  if (stale.length === 0) {
    return { ...empty, stale: 0 };
  }

  let scored = 0;
  let unscored = 0;
  let failed = 0;
  let domainsRemaining: number | null = null;

  for (
    let index = 0;
    index < stale.length;
    index += OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST
  ) {
    const chunk = stale.slice(
      index,
      index + OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST,
    );

    try {
      const batch = await fetchOpenPageRank({
        apiKey,
        domains: chunk,
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(fetchImpl !== undefined ? { fetchImpl } : {}),
      });
      domainsRemaining = batch.domainsRemaining ?? domainsRemaining;

      const byDomain = new Map(
        batch.scores.map((score) => [score.domain, score]),
      );
      const records: PostPublisherAuthorityBody = chunk.map((domain) => {
        const score = byDomain.get(domain);
        if (score === undefined) {
          unscored += 1;

          return {
            domain,
            openPageRank: null,
            globalRank: null,
            referringDomains: null,
            asOf: null,
          };
        }
        if (score.openPageRank === null) {
          unscored += 1;
        } else {
          scored += 1;
        }

        return {
          domain,
          openPageRank: score.openPageRank,
          globalRank: score.globalRank,
          referringDomains: score.referringDomains,
          asOf: score.asOf,
        };
      });

      await recordAuthority(records);
    } catch (error) {
      failed += chunk.length;
      logger?.warn(
        { err: error, batchSize: chunk.length },
        "publisher authority refresh batch failed; continuing",
      );
    }
  }

  return {
    requested: unique.length,
    stale: stale.length,
    scored,
    unscored,
    failed,
    skipped: false,
    domainsRemaining,
  };
}
