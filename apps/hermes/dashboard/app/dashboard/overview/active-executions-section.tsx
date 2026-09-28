import { CircleCheck } from "lucide-react";

import { getActiveExecutions } from "@/lib/dashboard-overview";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { OverviewEmptyState } from "./overview-empty-state";
import { OverviewExecutionList } from "./overview-execution-list";

export const ActiveExecutionsSection = async () => {
  const executions = await withDashboardAdmin(getActiveExecutions());
  if (executions.length === 0) {
    return (
      <OverviewEmptyState
        icon={CircleCheck}
        title="Nothing is running right now."
        description="Pending and running executions show up here."
      />
    );
  }
  const now = new Date();

  return <OverviewExecutionList executions={executions} now={now} />;
};
