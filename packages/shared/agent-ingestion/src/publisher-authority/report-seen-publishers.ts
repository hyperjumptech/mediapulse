import {
  PUBLISHER_SEEN_MAX,
  type PostPublishersSeenBody,
  type PostPublishersSeenResponse,
} from "@workspace/agent-data-api-contract";
import { derivePublisherFromUrl } from "@workspace/utils";

export type ReportPublishersSeen = (
  body: PostPublishersSeenBody,
) => Promise<PostPublishersSeenResponse>;

export type ReportSeenPublishersLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
};

export type ReportSeenPublishersOptions = {
  domains: readonly string[];
  reportSeen: ReportPublishersSeen;
  logger?: ReportSeenPublishersLogger;
};

export type ReportSeenPublishersResult = {
  requested: number;
  createdCount: number;
  touchedCount: number;
  failed: boolean;
};

/**
 * Registers the publisher domains a collection run persisted, so each one has a reference row.
 *
 * New domains are seeded with the name derived from the domain itself. Existing rows keep the
 * name they already hold, so a corrected name is never reverted.
 *
 * @param options - Domains seen, the transport that records them, and an optional logger.
 * @returns Counts of rows created and touched, and whether the call failed.
 */
export async function reportSeenPublishers({
  domains,
  reportSeen,
  logger,
}: ReportSeenPublishersOptions): Promise<ReportSeenPublishersResult> {
  const unique = [...new Set(domains.filter((domain) => domain !== ""))];
  const publishers = unique
    .map((domain) => ({
      domain,
      displayName: derivePublisherFromUrl(`https://${domain}`),
    }))
    .filter((publisher) => publisher.displayName !== "")
    .slice(0, PUBLISHER_SEEN_MAX);

  if (publishers.length === 0) {
    return {
      requested: unique.length,
      createdCount: 0,
      touchedCount: 0,
      failed: false,
    };
  }

  try {
    const result = await reportSeen({ publishers });
    logger?.info(
      {
        requested: publishers.length,
        createdCount: result.createdCount,
        touchedCount: result.touchedCount,
      },
      "recorded seen publishers",
    );

    return {
      requested: publishers.length,
      createdCount: result.createdCount,
      touchedCount: result.touchedCount,
      failed: false,
    };
  } catch (error) {
    logger?.warn(
      { err: error, requested: publishers.length },
      "failed to record seen publishers",
    );

    return {
      requested: publishers.length,
      createdCount: 0,
      touchedCount: 0,
      failed: true,
    };
  }
}
