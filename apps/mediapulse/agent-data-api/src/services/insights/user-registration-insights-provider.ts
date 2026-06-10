import type {
  InsightsPayload,
  KpiCard,
  InsightAlert,
  InsightSection,
} from "@workspace/agent-data-api-contract";

import type {
  AgentInsightsProvider,
  InsightsContext,
} from "../agent-insights-registry.js";

const TOP_N = 10;

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type UserRow = {
  createdAt: Date;
};

type UserTickerRow = {
  id: string;
  tickerId: string;
  userId: string;
  enabled: boolean;
  createdAt: Date;
  registrationConfirmedAt: Date | null;
  unsubscribedAt: Date | null;
  unsubscribeMethod: string | null;
  ticker: { symbol: string };
};

type UserRegistrationInsightsDeps = {
  mediapulseUser: {
    findMany: (args: {
      where: { createdAt: { gte: Date } };
      select: { createdAt: boolean };
    }) => Promise<UserRow[]>;
  };
  userTicker: {
    findMany: (args: {
      where: {
        createdAt?: { gte: Date };
        registrationConfirmedAt?: { gte: Date };
        unsubscribedAt?: { gte: Date } | null;
        enabled?: boolean;
        tickerId?: string;
      };
      select: {
        id: boolean;
        tickerId: boolean;
        userId: boolean;
        enabled: boolean;
        createdAt: boolean;
        registrationConfirmedAt: boolean;
        unsubscribedAt: boolean;
        unsubscribeMethod: boolean;
        ticker: { select: { symbol: boolean } };
      };
      take?: number;
    }) => Promise<UserTickerRow[]>;
  };
};

function bucketTopN<T extends { label: string; value: number }>(
  items: T[],
  n: number,
): T[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= n) {
    return sorted;
  }
  const top = sorted.slice(0, n);
  const restValue = sorted.slice(n).reduce((sum, item) => sum + item.value, 0);
  if (restValue > 0) {
    return [...top, { label: "Other", value: restValue } as T];
  }
  return top;
}

function buildWindowDates(
  windowStart: Date,
  windowEnd: Date,
): Map<string, number> {
  const buckets = new Map<string, number>();
  const current = new Date(windowStart);
  while (current <= windowEnd) {
    const key = current.toISOString().slice(0, 10);
    buckets.set(key, 0);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return buckets;
}

function mergeByIdDedup(rows: UserTickerRow[][]): UserTickerRow[] {
  const seen = new Map<string, UserTickerRow>();
  for (const batch of rows) {
    for (const row of batch) {
      if (!seen.has(row.id)) {
        seen.set(row.id, row);
      }
    }
  }
  return Array.from(seen.values());
}

export function createUserRegistrationInsightsProvider(
  deps: UserRegistrationInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "user-registration",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const tickerFilter = ctx.tickerId ? { tickerId: ctx.tickerId } : {};
      const fullSelect = {
        id: true,
        tickerId: true,
        userId: true,
        enabled: true,
        createdAt: true,
        registrationConfirmedAt: true,
        unsubscribedAt: true,
        unsubscribeMethod: true,
        ticker: { select: { symbol: true } },
      };

      const [
        allUsers,
        newSubRows,
        confirmedRows,
        unsubscribedRows,
        activeRows,
      ] = await Promise.all([
        deps.mediapulseUser.findMany({
          where: { createdAt: { gte: priorStart } },
          select: { createdAt: true },
        }),
        deps.userTicker.findMany({
          where: { createdAt: { gte: priorStart }, ...tickerFilter },
          select: fullSelect,
        }),
        deps.userTicker.findMany({
          where: {
            registrationConfirmedAt: { gte: windowStart },
            ...tickerFilter,
          },
          select: fullSelect,
        }),
        deps.userTicker.findMany({
          where: {
            unsubscribedAt: { gte: windowStart },
            ...tickerFilter,
          },
          select: fullSelect,
        }),
        deps.userTicker.findMany({
          where: { enabled: true, unsubscribedAt: null, ...tickerFilter },
          select: fullSelect,
          take: 5000,
        }),
      ]);

      // Merge and deduplicate rows touched in the window
      const windowTouched = mergeByIdDedup([
        newSubRows.filter((r) => r.createdAt >= windowStart),
        confirmedRows,
        unsubscribedRows,
      ]);

      const currentSubs = newSubRows.filter((r) => r.createdAt >= windowStart);
      const priorSubs = newSubRows.filter(
        (r) => r.createdAt >= priorStart && r.createdAt < windowStart,
      );

      const currentUsers = allUsers.filter((u) => u.createdAt >= windowStart);
      const priorUsers = allUsers.filter(
        (u) => u.createdAt >= priorStart && u.createdAt < windowStart,
      );

      // All confirmed in window (including older subs that confirmed this window)
      const confirmedInWindow = mergeByIdDedup([
        newSubRows.filter(
          (r) =>
            r.registrationConfirmedAt !== null &&
            r.registrationConfirmedAt >= windowStart,
        ),
        confirmedRows,
      ]);

      // All unsubscribed in window (including older subs)
      const unsubscribedInWindow = mergeByIdDedup([
        newSubRows.filter(
          (r) => r.unsubscribedAt !== null && r.unsubscribedAt >= windowStart,
        ),
        unsubscribedRows,
      ]);

      const priorConfirmed = newSubRows.filter(
        (r) =>
          r.createdAt >= priorStart &&
          r.createdAt < windowStart &&
          r.registrationConfirmedAt !== null,
      );
      const priorUnsubscribed = newSubRows.filter(
        (r) =>
          r.createdAt >= priorStart &&
          r.createdAt < windowStart &&
          r.unsubscribedAt !== null,
      );

      // ─── KPIs ────────────────────────────────────────────────────────────

      const totalNewUsers = currentUsers.length;
      const totalNewSubs = currentSubs.length;
      const totalConfirmedInWindow = confirmedInWindow.length;
      const totalUnsubscribedInWindow = unsubscribedInWindow.length;
      const totalActive = activeRows.length;

      const confirmationRate =
        totalNewSubs > 0
          ? Math.round((totalConfirmedInWindow / totalNewSubs) * 100)
          : 0;

      const priorConfirmationRate =
        priorSubs.length > 0
          ? Math.round((priorConfirmed.length / priorSubs.length) * 100)
          : null;

      const kpis: KpiCard[] = [
        {
          id: "new_users",
          label: "New users",
          value: totalNewUsers,
          delta: totalNewUsers - priorUsers.length,
        },
        {
          id: "new_subscriptions",
          label: "New subscriptions",
          value: totalNewSubs,
          delta: totalNewSubs - priorSubs.length,
        },
        {
          id: "confirmation_rate",
          label: "Confirmation rate",
          value: confirmationRate,
          unit: "%",
        },
        {
          id: "active_subscribers",
          label: "Active subscribers",
          value: totalActive,
        },
        {
          id: "unsubscribes",
          label: "Unsubscribes",
          value: totalUnsubscribedInWindow,
          delta: totalUnsubscribedInWindow - priorUnsubscribed.length,
        },
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      if (
        priorConfirmationRate !== null &&
        priorConfirmationRate > 0 &&
        confirmationRate < priorConfirmationRate - 20
      ) {
        alerts.push({
          id: "confirmation-rate-drop",
          severity: "warning",
          message: `Confirmation rate dropped from ${priorConfirmationRate}% to ${confirmationRate}%`,
          sectionRef: "how-confirmation-rate",
        });
      }

      const priorUnsubRate =
        priorSubs.length > 0
          ? Math.round((priorUnsubscribed.length / priorSubs.length) * 100)
          : 0;
      const currentUnsubRate =
        totalNewSubs > 0
          ? Math.round((totalUnsubscribedInWindow / totalNewSubs) * 100)
          : 0;
      if (
        priorUnsubRate > 0 &&
        currentUnsubRate > priorUnsubRate * 2 &&
        totalUnsubscribedInWindow > 3
      ) {
        alerts.push({
          id: "unsubscribe-spike",
          severity: "warning",
          message: `Unsubscribe rate spiked: ${currentUnsubRate}% vs ${priorUnsubRate}% in the prior window`,
          sectionRef: "why-unsubscribe-method",
        });
      }

      if (totalNewSubs === 0 && ctx.window !== "24h") {
        alerts.push({
          id: "no-new-registrations",
          severity: "info",
          message: "No new subscriptions in the window",
        });
      }

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      // What — subscription lifecycle funnel
      // Active = confirmed-in-window rows that are still enabled and not unsubscribed.
      // This ensures each stage is a subset of the previous.
      const activeConfirmedRows = confirmedInWindow.filter(
        (r) => r.enabled && r.unsubscribedAt === null,
      ).length;
      sections.push({
        id: "what-lifecycle-funnel",
        category: "what",
        title: "Subscription lifecycle",
        insight:
          "New = created this window; Confirmed = confirmed this window; Active = confirmed this window and still enabled; Unsubscribed = unsubscribed this window.",
        widget: {
          kind: "funnel",
          stages: [
            { label: "New subscriptions", value: totalNewSubs },
            { label: "Confirmed", value: totalConfirmedInWindow },
            { label: "Active", value: activeConfirmedRows },
            { label: "Unsubscribed", value: totalUnsubscribedInWindow },
          ],
        },
      });

      // When — registrations and confirmations per day
      const regDailyBuckets = buildWindowDates(windowStart, now);
      const confDailyBuckets = buildWindowDates(windowStart, now);

      for (const sub of currentSubs) {
        const dayKey = sub.createdAt.toISOString().slice(0, 10);
        if (regDailyBuckets.has(dayKey)) {
          regDailyBuckets.set(dayKey, (regDailyBuckets.get(dayKey) ?? 0) + 1);
        }
      }
      for (const sub of confirmedInWindow) {
        if (sub.registrationConfirmedAt === null) continue;
        const dayKey = sub.registrationConfirmedAt.toISOString().slice(0, 10);
        if (confDailyBuckets.has(dayKey)) {
          confDailyBuckets.set(dayKey, (confDailyBuckets.get(dayKey) ?? 0) + 1);
        }
      }

      sections.push({
        id: "when-registrations",
        category: "when",
        title: "Registrations over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(regDailyBuckets.entries()).map(([ts, value]) => ({
            ts: `${ts}T00:00:00.000Z`,
            value,
          })),
          unit: "subscriptions",
        },
      });

      const hasConfirmations = Array.from(confDailyBuckets.values()).some(
        (v) => v > 0,
      );
      if (hasConfirmations) {
        sections.push({
          id: "when-confirmations",
          category: "when",
          title: "Confirmations over time",
          widget: {
            kind: "timeSeries",
            points: Array.from(confDailyBuckets.entries()).map(
              ([ts, value]) => ({
                ts: `${ts}T00:00:00.000Z`,
                value,
              }),
            ),
            unit: "confirmations",
          },
        });
      }

      // Where — active subscriptions per ticker (top-N)
      const perTickerActive = new Map<string, number>();
      for (const row of activeRows) {
        perTickerActive.set(
          row.ticker.symbol,
          (perTickerActive.get(row.ticker.symbol) ?? 0) + 1,
        );
      }
      if (perTickerActive.size > 0) {
        sections.push({
          id: "where-per-ticker",
          category: "where",
          title: "Active subscribers by ticker",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(perTickerActive.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "subscribers",
          },
        });
      }

      // Who — subscription status breakdown (for subscriptions touched in window)
      const statusCounts = { pending: 0, confirmedActive: 0, unsubscribed: 0 };
      for (const row of windowTouched) {
        if (row.unsubscribedAt !== null) {
          statusCounts.unsubscribed += 1;
        } else if (row.registrationConfirmedAt !== null && row.enabled) {
          statusCounts.confirmedActive += 1;
        } else {
          statusCounts.pending += 1;
        }
      }
      const statusTotal =
        statusCounts.pending +
        statusCounts.confirmedActive +
        statusCounts.unsubscribed;
      if (statusTotal > 0) {
        sections.push({
          id: "who-status-breakdown",
          category: "who",
          title: "Subscription status",
          widget: {
            kind: "breakdown",
            slices: [
              {
                label: "Pending",
                value: statusCounts.pending,
                fraction:
                  statusTotal > 0 ? statusCounts.pending / statusTotal : 0,
              },
              {
                label: "Confirmed active",
                value: statusCounts.confirmedActive,
                fraction:
                  statusTotal > 0
                    ? statusCounts.confirmedActive / statusTotal
                    : 0,
              },
              {
                label: "Unsubscribed",
                value: statusCounts.unsubscribed,
                fraction:
                  statusTotal > 0 ? statusCounts.unsubscribed / statusTotal : 0,
              },
            ].filter((s) => s.value > 0),
          },
        });
      }

      // Why — unsubscribe-method breakdown (only rows with unsubscribeMethod set)
      const methodCounts = new Map<string, number>();
      for (const row of unsubscribedInWindow) {
        if (row.unsubscribeMethod === null) continue;
        methodCounts.set(
          row.unsubscribeMethod,
          (methodCounts.get(row.unsubscribeMethod) ?? 0) + 1,
        );
      }
      if (methodCounts.size > 0) {
        const methodTotal = Array.from(methodCounts.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "why-unsubscribe-method",
          category: "why",
          title: "Unsubscribe method",
          widget: {
            kind: "breakdown",
            slices: Array.from(methodCounts.entries()).map(
              ([label, value]) => ({
                label,
                value,
                fraction: methodTotal > 0 ? value / methodTotal : 0,
              }),
            ),
          },
        });
      }

      // How — confirmation-rate stat
      sections.push({
        id: "how-confirmation-rate",
        category: "how",
        title: "Confirmation rate",
        widget: {
          kind: "stat",
          value: confirmationRate,
          unit: "%",
        },
      });

      return {
        agentId: "user-registration",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}
