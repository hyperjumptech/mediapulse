import { subDays } from "date-fns";
import { ShieldCheck } from "lucide-react";

import { getRecentFailures } from "@/lib/dashboard-overview";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { OverviewEmptyState } from "./overview-empty-state";
import { OverviewExecutionList } from "./overview-execution-list";

export const RecentFailuresSection = async () => {
  const now = new Date();
  const since = subDays(now, 7);
  const executions = await withDashboardAdmin(getRecentFailures(since));
  if (executions.length === 0) {
    return (
      <OverviewEmptyState
        icon={ShieldCheck}
        title="No failed runs in the last 7 days."
        description="Failed and partial runs show up here for a week."
      />
    );
  }

  return <OverviewExecutionList executions={executions} now={now} />;
};
