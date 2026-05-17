import type { Prisma } from "@mediapulse/database";

import type { NewsletterDeliveryAggregate } from "./list-mapper";

type CheckpointGroupRow = { newsletterId: string; _count: { _all: number } };
type UserTickerGroupRow = { tickerId: string; _count: { _all: number } };
type DeliveryRunSummaryRow = {
  newsletterId: string | null;
  successCount: number;
  failureCount: number;
  skippedCount: number;
};

/**
 * Minimal Prisma surface required by {@link buildDeliveryAggregateMap}. Lets
 * the caller inject fakes during unit testing.
 */
export type DeliveryAggregateDeps = {
  newsletterDeliveryCheckpoint: Pick<
    typeof import("@mediapulse/database").prisma.newsletterDeliveryCheckpoint,
    "groupBy"
  >;
  deliveryRun: Pick<
    typeof import("@mediapulse/database").prisma.deliveryRun,
    "findMany"
  >;
  userTicker: Pick<
    typeof import("@mediapulse/database").prisma.userTicker,
    "groupBy"
  >;
};

const ZERO_AGGREGATE: NewsletterDeliveryAggregate = {
  deliveryDelivered: 0,
  deliveryEnabledAtSendTime: 0,
  deliveryHasRun: false,
};

/**
 * Batches delivery stats for many newsletters in a single follow-up query so
 * list endpoints stay free of N+1 reads.
 *
 * - `deliveryDelivered` = count of `NewsletterDeliveryCheckpoint` rows for each newsletter.
 * - `deliveryEnabledAtSendTime` = `success + failure + skipped` from the latest
 *   `DeliveryRun` for the newsletter; falls back to the current enabled
 *   `UserTicker` count for the ticker when no run exists.
 * - `deliveryHasRun` = whether any `DeliveryRun` row exists for the newsletter.
 *
 * @param newsletters - List of `{ id, tickerId }` pairs from the paginated list query.
 * @param deps - Prisma collaborators (default: workspace Prisma client).
 * @returns A map keyed by newsletter id.
 */
export async function buildDeliveryAggregateMap(
  newsletters: ReadonlyArray<{ id: string; tickerId: string }>,
  deps: DeliveryAggregateDeps,
): Promise<Map<string, NewsletterDeliveryAggregate>> {
  const map = new Map<string, NewsletterDeliveryAggregate>();
  if (newsletters.length === 0) return map;

  const newsletterIds = newsletters.map((newsletter) => newsletter.id);
  const tickerIds = Array.from(
    new Set(newsletters.map((newsletter) => newsletter.tickerId)),
  );

  const checkpointGroupArgs: Prisma.NewsletterDeliveryCheckpointGroupByArgs = {
    by: ["newsletterId"],
    where: { newsletterId: { in: newsletterIds } },
    _count: { _all: true },
  };
  const checkpointGroups = (await deps.newsletterDeliveryCheckpoint.groupBy(
    checkpointGroupArgs as never,
  )) as ReadonlyArray<CheckpointGroupRow>;
  const deliveredByNewsletter = new Map<string, number>();
  for (const group of checkpointGroups) {
    deliveredByNewsletter.set(group.newsletterId, group._count._all);
  }

  const deliveryRunArgs = {
    where: { newsletterId: { in: newsletterIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      newsletterId: true,
      successCount: true,
      failureCount: true,
      skippedCount: true,
    },
  } satisfies Prisma.DeliveryRunFindManyArgs;
  const runs = (await deps.deliveryRun.findMany(
    deliveryRunArgs,
  )) as ReadonlyArray<DeliveryRunSummaryRow>;
  const latestRunByNewsletter = new Map<
    string,
    { successCount: number; failureCount: number; skippedCount: number }
  >();
  for (const run of runs) {
    if (run.newsletterId === null) continue;
    if (latestRunByNewsletter.has(run.newsletterId)) continue;
    latestRunByNewsletter.set(run.newsletterId, {
      successCount: run.successCount,
      failureCount: run.failureCount,
      skippedCount: run.skippedCount,
    });
  }

  const userTickerGroupArgs: Prisma.UserTickerGroupByArgs = {
    by: ["tickerId"],
    where: { tickerId: { in: tickerIds }, enabled: true },
    _count: { _all: true },
  };
  const userTickerGroups = (await deps.userTicker.groupBy(
    userTickerGroupArgs as never,
  )) as ReadonlyArray<UserTickerGroupRow>;
  const enabledByTicker = new Map<string, number>();
  for (const group of userTickerGroups) {
    enabledByTicker.set(group.tickerId, group._count._all);
  }

  for (const newsletter of newsletters) {
    const delivered = deliveredByNewsletter.get(newsletter.id) ?? 0;
    const latestRun = latestRunByNewsletter.get(newsletter.id);
    if (latestRun) {
      map.set(newsletter.id, {
        deliveryDelivered: delivered,
        deliveryEnabledAtSendTime:
          latestRun.successCount +
          latestRun.failureCount +
          latestRun.skippedCount,
        deliveryHasRun: true,
      });
      continue;
    }
    const enabled = enabledByTicker.get(newsletter.tickerId);
    if (enabled === undefined) {
      map.set(newsletter.id, ZERO_AGGREGATE);
      continue;
    }
    map.set(newsletter.id, {
      deliveryDelivered: delivered,
      deliveryEnabledAtSendTime: enabled,
      deliveryHasRun: false,
    });
  }

  return map;
}
