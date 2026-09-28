import { ExecutionActivityChart } from "@/components/execution-activity-chart";
import { getExecutionDailySeries } from "@/lib/dashboard-overview";
import { getViewerDateTimeContext } from "@/lib/date-time/viewer-date-time";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

const CHART_HISTORY_DAYS = 90;

export const ExecutionActivitySection = async () => {
  const { timeZone, renderedAt } = await getViewerDateTimeContext();
  const points = await withDashboardAdmin(
    getExecutionDailySeries({
      days: CHART_HISTORY_DAYS,
      timeZone,
      now: new Date(renderedAt),
    }),
  );

  return <ExecutionActivityChart points={points} />;
};
