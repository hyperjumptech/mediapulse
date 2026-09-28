import { StatCard, StatCardGrid } from "@/components/stat-card";
import { getExecutionStatusCountsInWindow } from "@/lib/dashboard-overview";
import {
  buildCountTrend,
  buildRateTrend,
  formatPercent,
  successRate,
} from "@/lib/overview-trends";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

const DAY_MILLISECONDS = 86_400_000;

const describeCountChange = (direction: string, noun: string): string => {
  if (direction === "up") {
    return `More ${noun} than the day before`;
  }
  if (direction === "down") {
    return `Fewer ${noun} than the day before`;
  }

  return `Same as the day before`;
};

export const ExecutionStatsSection = async ({
  now = new Date(),
}: {
  now?: Date;
} = {}) => {
  const currentWindowStart = new Date(now.getTime() - DAY_MILLISECONDS);
  const previousWindowStart = new Date(now.getTime() - 2 * DAY_MILLISECONDS);
  const [current, previous] = await withDashboardAdmin(
    Promise.all([
      getExecutionStatusCountsInWindow({ since: currentWindowStart }),
      getExecutionStatusCountsInWindow({
        since: previousWindowStart,
        until: currentWindowStart,
      }),
    ]),
  );
  const runsTrend = buildCountTrend(current.total, previous.total);
  const failedTrend = buildCountTrend(current.failed, previous.failed);
  const currentSuccessRate = successRate(current);
  const successTrend = buildRateTrend(
    currentSuccessRate,
    successRate(previous),
  );

  return (
    <StatCardGrid>
      <StatCard
        label="Runs (24h)"
        value={current.total.toLocaleString("en-US")}
        trend={runsTrend}
        headline={describeCountChange(runsTrend.direction, "runs")}
        description="Schedules, HTTP triggers and manual runs"
      />
      <StatCard
        label="Success rate (24h)"
        value={formatPercent(currentSuccessRate)}
        trend={successTrend}
        headline={
          currentSuccessRate === null
            ? "No finished runs yet"
            : `${current.succeeded.toLocaleString("en-US")} runs succeeded`
        }
        description="Finished runs that succeeded"
      />
      <StatCard
        label="Failed runs (24h)"
        value={current.failed.toLocaleString("en-US")}
        trend={failedTrend}
        valueClassName={
          current.failed > 0 ? "text-destructive dark:text-red-400" : undefined
        }
        headline={current.failed > 0 ? "Needs attention" : "No failures"}
        description="Failed and partial runs"
      />
      <StatCard
        label="Running now"
        value={current.running.toLocaleString("en-US")}
        headline={current.running > 0 ? "In progress" : "Nothing running"}
        description="Pending and running executions"
      />
    </StatCardGrid>
  );
};
