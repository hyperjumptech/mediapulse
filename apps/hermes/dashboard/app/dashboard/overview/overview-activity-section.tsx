import { subDays } from "date-fns";

import { getOverviewActivity } from "@/lib/dashboard-overview";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { OverviewActivityTabs } from "./overview-activity-tabs";
import {
  OVERVIEW_ACTIVITY_TABLE_IDS,
  OVERVIEW_FAILURE_WINDOW_DAYS,
} from "./overview-activity-views";

export const OverviewActivitySection = async () => {
  const failuresSince = subDays(new Date(), OVERVIEW_FAILURE_WINDOW_DAYS);
  const [activity, running, failed, upcoming] = await Promise.all([
    withDashboardAdmin(getOverviewActivity(failuresSince)),
    readColumnVisibility(OVERVIEW_ACTIVITY_TABLE_IDS.running),
    readColumnVisibility(OVERVIEW_ACTIVITY_TABLE_IDS.failed),
    readColumnVisibility(OVERVIEW_ACTIVITY_TABLE_IDS.upcoming),
  ]);

  return (
    <OverviewActivityTabs
      activity={activity}
      columnVisibility={{ running, failed, upcoming }}
    />
  );
};
