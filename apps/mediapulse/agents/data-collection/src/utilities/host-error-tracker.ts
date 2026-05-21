import {
  isDeadUrlCacheable,
  type DeadUrlCacheableCategory,
  type DeadUrlRecordInput,
  type PostDataCollectionDeadUrlsRecordBody,
} from "@workspace/agent-data-api-contract";

import type { QualityDropReason } from "./content-quality-gate";
import type { WebFetchFailure } from "./web-fetch";

export type QualityDropForDeadUrl = {
  url: string;
  reason: QualityDropReason;
};

/**
 * Per-run host error tracker: marks hosts skipped when error rate exceeds threshold.
 */
export class HostErrorTracker {
  private readonly stats = new Map<
    string,
    { successes: number; failures: number; skipped: boolean }
  >();

  /**
   * @param config - Breaker settings; when disabled, all methods are no-ops.
   */
  constructor(
    private readonly config: {
      enabled: boolean;
      minAttempts: number;
      errorRateThreshold: number;
    },
  ) {}

  /**
   * Records one fetch attempt outcome for a host.
   *
   * @param host - Hostname (e.g. from `URL.hostname`).
   * @param success - Whether the fetch succeeded.
   */
  record(host: string, success: boolean): void {
    if (!this.config.enabled) {
      return;
    }

    const current = this.stats.get(host) ?? {
      successes: 0,
      failures: 0,
      skipped: false,
    };

    if (current.skipped) {
      return;
    }

    if (success) {
      current.successes += 1;
    } else {
      current.failures += 1;
    }

    const attempts = current.successes + current.failures;
    if (attempts >= this.config.minAttempts) {
      const errorRate = current.failures / attempts;
      if (errorRate > this.config.errorRateThreshold) {
        current.skipped = true;
      }
    }

    this.stats.set(host, current);
  }

  /**
   * Returns whether further fetches to this host should be skipped this run.
   *
   * @param host - Hostname to check.
   */
  isSkipped(host: string): boolean {
    if (!this.config.enabled) {
      return false;
    }
    return this.stats.get(host)?.skipped ?? false;
  }
}

/**
 * Extracts the hostname from a URL for host-level tracking.
 *
 * @param url - Full URL string.
 */
export const hostFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const qualityReasonToErrorCategory = (
  reason: QualityDropReason,
): DeadUrlCacheableCategory | null => {
  if (reason === "content_too_short") {
    return "content_too_short";
  }
  return null;
};

/**
 * Builds dead-url record payloads from fetch failures and quality-gate drops.
 *
 * @param tickerId - Ticker id for all records.
 * @param fetchFailures - Failed fetch attempts from the round.
 * @param qualityDrops - URLs dropped by the content quality gate.
 */
export const buildDeadUrlRecords = (
  tickerId: string,
  fetchFailures: readonly WebFetchFailure[],
  qualityDrops: readonly QualityDropForDeadUrl[],
): PostDataCollectionDeadUrlsRecordBody => {
  const records: DeadUrlRecordInput[] = [];
  const seen = new Set<string>();

  for (const failure of fetchFailures) {
    if (!isDeadUrlCacheable(failure.errorCategory, failure.httpStatus)) {
      continue;
    }
    if (seen.has(failure.url)) {
      continue;
    }
    seen.add(failure.url);
    records.push({
      tickerId,
      url: failure.url,
      errorCategory: failure.errorCategory as DeadUrlCacheableCategory,
      ...(failure.httpStatus !== undefined
        ? { httpStatus: failure.httpStatus }
        : {}),
    });
  }

  for (const drop of qualityDrops) {
    const category = qualityReasonToErrorCategory(drop.reason);
    if (!category || !isDeadUrlCacheable(category)) {
      continue;
    }
    if (seen.has(drop.url)) {
      continue;
    }
    seen.add(drop.url);
    records.push({
      tickerId,
      url: drop.url,
      errorCategory: category,
    });
  }

  return records;
};
