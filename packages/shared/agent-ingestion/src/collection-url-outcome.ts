import type { CollectionUrlOutcomeInput } from "@workspace/agent-data-api-contract";
import type { QualityDropReason } from "./content-quality-gate";
import type { FreshnessDropReason } from "./freshness-gate";
import type { UrlNoiseReason } from "@workspace/utils";

export type { CollectionUrlOutcomeInput };

/** Stable machine tokens for per-URL outcomes. Used for filtering and counter reconciliation. */
export type CollectionUrlOutcomeReason =
  | `url_noise_${UrlNoiseReason}`
  | QualityDropReason
  | `relevance_no_match`
  | `freshness_${FreshnessDropReason}`
  | "duplicate_canonical_url"
  | "existing_canonical_url"
  | "dead_url_cache"
  | "host_error_rate"
  | "fetch_failed"
  | "empty_description"
  | "prefilter_alias_mismatch"
  | "dropped_by_candidate_budget"
  | "dropped_by_run_item_cap";

/**
 * Human-readable fallback labels for each reason token, used when `reasonDetail` is absent.
 */
export const REASON_LABELS: Record<string, string> = {
  url_noise_blocked_host: "Blocked host",
  url_noise_low_value_source: "Low-value static or market-research source",
  url_noise_blocked_host_path: "Blocked host path",
  url_noise_blocked_path: "Blocked path",
  url_noise_blocked_extension: "Blocked file extension",
  content_no_title: "Missing or blocked title",
  content_soft_404: "Page not found",
  content_access_gated: "Access gated (paywall or login required)",
  content_too_short: "Content too short",
  content_repetitive: "Content is repetitive",
  content_link_farm: "Link farm — too many links",
  content_index_like: "Index-like or non-article content",
  relevance_no_match: "Not relevant to ticker",
  freshness_too_old: "Published date too old",
  freshness_future_dated: "Publish date is in the future",
  freshness_unknown_date: "No detectable publish date",
  duplicate_canonical_url: "Duplicate URL in this run",
  existing_canonical_url: "Already collected in a previous run",
  dead_url_cache: "Previously recorded as a dead URL",
  host_error_rate: "Host exceeded error-rate threshold",
  fetch_failed: "Fetch failed",
  empty_description: "No description available at collection",
  prefilter_alias_mismatch: "Pre-filter: no ticker/industry mention",
  dropped_by_candidate_budget: "Candidate budget exhausted for this run",
  dropped_by_run_item_cap: "Run item cap reached",
};

type DropOutcomeContext =
  | { reason: `url_noise_${UrlNoiseReason}`; detail: string }
  | { reason: QualityDropReason; charCount?: number; minChars?: number }
  | {
      reason: "relevance_no_match";
      /** Omitted by ticker-agnostic collectors, which match against every tracked ticker. */
      tickerSymbol?: string;
      headChars: number;
    }
  | { reason: "freshness_too_old"; publishedAt: Date; maxAgeDays: number }
  | { reason: "freshness_future_dated"; publishedAt: Date }
  | { reason: "freshness_unknown_date" }
  | { reason: "duplicate_canonical_url" }
  | { reason: "existing_canonical_url" }
  | { reason: "dead_url_cache" }
  | { reason: "host_error_rate"; host: string }
  | { reason: "fetch_failed"; errorCategory: string; httpStatus?: number }
  | { reason: "empty_description" }
  | { reason: "prefilter_alias_mismatch" }
  | { reason: "dropped_by_candidate_budget" }
  | { reason: "dropped_by_run_item_cap" };

/**
 * Builds both the stable machine reason token and a human-readable detail sentence
 * from the context available at the drop site.
 *
 * @param context - Drop reason and in-scope diagnostic values.
 * @returns Object with `reason` (stable token) and `reasonDetail` (display sentence).
 */
export const describeOutcomeReason = (
  context: DropOutcomeContext,
): { reason: string; reasonDetail: string } => {
  switch (context.reason) {
    case "url_noise_blocked_host":
    case "url_noise_low_value_source":
    case "url_noise_blocked_host_path":
    case "url_noise_blocked_path":
    case "url_noise_blocked_extension": {
      const label = REASON_LABELS[context.reason] ?? context.reason;
      return {
        reason: context.reason,
        reasonDetail: `${label}: ${context.detail}`,
      };
    }

    case "content_no_title":
    case "content_soft_404":
    case "content_access_gated":
    case "content_repetitive":
    case "content_link_farm":
    case "content_index_like":
      return {
        reason: context.reason,
        reasonDetail: REASON_LABELS[context.reason] ?? context.reason,
      };

    case "content_too_short": {
      const charCount = context.charCount;
      const minChars = context.minChars;
      return {
        reason: context.reason,
        reasonDetail:
          charCount !== undefined && minChars !== undefined
            ? `Content too short: ${charCount} chars (min ${minChars})`
            : "Content too short",
      };
    }

    case "relevance_no_match": {
      const subject = context.tickerSymbol ?? "any tracked ticker";

      return {
        reason: context.reason,
        reasonDetail: `No mention of ${subject} or its industry in the first ${String(context.headChars)} chars`,
      };
    }

    case "freshness_too_old": {
      const dateStr = context.publishedAt.toISOString().slice(0, 10);
      return {
        reason: context.reason,
        reasonDetail: `Published ${dateStr}, older than the ${context.maxAgeDays}-day freshness window`,
      };
    }

    case "freshness_future_dated": {
      const dateStr = context.publishedAt.toISOString().slice(0, 10);
      return {
        reason: context.reason,
        reasonDetail: `Publish date ${dateStr} is in the future`,
      };
    }

    case "freshness_unknown_date":
      return {
        reason: context.reason,
        reasonDetail: "No detectable publish date",
      };

    case "duplicate_canonical_url":
      return {
        reason: context.reason,
        reasonDetail: "Duplicate of another URL already seen in this run",
      };

    case "existing_canonical_url":
      return {
        reason: context.reason,
        reasonDetail: "Already stored from an earlier run",
      };

    case "dead_url_cache":
      return {
        reason: context.reason,
        reasonDetail: "Skipped: previously recorded as a dead URL",
      };

    case "host_error_rate":
      return {
        reason: context.reason,
        reasonDetail: `Skipped: ${context.host} exceeded the error-rate threshold this run`,
      };

    case "fetch_failed": {
      const status = context.httpStatus ? `, HTTP ${context.httpStatus}` : "";
      return {
        reason: context.reason,
        reasonDetail: `Fetch failed: ${context.errorCategory}${status}`,
      };
    }

    case "empty_description":
      return {
        reason: context.reason,
        reasonDetail: "No description available at collection",
      };

    case "prefilter_alias_mismatch":
      return {
        reason: context.reason,
        reasonDetail: "Pre-filter: no ticker or industry mention detected",
      };

    case "dropped_by_candidate_budget":
      return {
        reason: context.reason,
        reasonDetail: "Candidate budget exhausted for this run",
      };

    case "dropped_by_run_item_cap":
      return {
        reason: context.reason,
        reasonDetail: "Run item cap reached",
      };
  }
};

/** Builds a `CollectionUrlOutcomeInput` for a dropped URL. */
export const makeDroppedOutcome = (
  fields: Pick<
    CollectionUrlOutcomeInput,
    "id" | "scheduleExecutionId" | "runId" | "agent" | "url" | "createdAt"
  > &
    Partial<
      Pick<
        CollectionUrlOutcomeInput,
        "tickerId" | "source" | "searchQueryId" | "curatedSourceId"
      >
    >,
  dropContext: DropOutcomeContext,
): CollectionUrlOutcomeInput => {
  const { reason, reasonDetail } = describeOutcomeReason(dropContext);
  return {
    ...fields,
    status: "dropped",
    reason,
    reasonDetail,
  };
};

/** Builds a `CollectionUrlOutcomeInput` for a successfully collected URL. */
export const makeCollectedOutcome = (
  fields: Pick<
    CollectionUrlOutcomeInput,
    "id" | "scheduleExecutionId" | "runId" | "agent" | "url" | "createdAt"
  > &
    Partial<
      Pick<
        CollectionUrlOutcomeInput,
        "tickerId" | "source" | "searchQueryId" | "curatedSourceId"
      >
    >,
): CollectionUrlOutcomeInput => ({
  ...fields,
  status: "collected",
  reason: undefined,
  reasonDetail: undefined,
});

/** Builds a `CollectionUrlOutcomeInput` for a fetch-failed URL. */
export const makeFailedOutcome = (
  fields: Pick<
    CollectionUrlOutcomeInput,
    | "id"
    | "scheduleExecutionId"
    | "runId"
    | "tickerId"
    | "agent"
    | "url"
    | "source"
    | "searchQueryId"
    | "createdAt"
  >,
  errorCategory: string,
  httpStatus?: number,
): CollectionUrlOutcomeInput => {
  const { reason, reasonDetail } = describeOutcomeReason({
    reason: "fetch_failed",
    errorCategory,
    httpStatus,
  });
  return {
    ...fields,
    status: "failed",
    reason,
    reasonDetail,
  };
};

/** Posts outcomes in chunks to avoid request size limits. */
export const postOutcomesInChunks = async <TOutcome>(
  outcomes: TOutcome[],
  post: (batch: TOutcome[]) => Promise<unknown>,
  chunkSize = 200,
): Promise<void> => {
  for (let i = 0; i < outcomes.length; i += chunkSize) {
    await post(outcomes.slice(i, i + chunkSize));
  }
};
