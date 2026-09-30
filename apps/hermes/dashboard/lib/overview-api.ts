import {
  getExecutionDailySeries,
  getExecutionStatusCountsInWindow,
  getOverviewActivity,
} from "@/lib/dashboard-overview";
import { OVERVIEW_FAILURE_WINDOW_DAYS } from "@/app/dashboard/overview/overview-activity-views";

const DAY_MILLISECONDS = 86_400_000;

export type OverviewApiInput = {
  days: number;
  timeZone: string;
  now: Date;
};

export type OverviewApiDependencies = {
  getStatusCounts: typeof getExecutionStatusCountsInWindow;
  getActivity: typeof getOverviewActivity;
  getDailySeries: typeof getExecutionDailySeries;
};

const defaultDependencies: OverviewApiDependencies = {
  getStatusCounts: (window) => getExecutionStatusCountsInWindow(window),
  getActivity: (failuresSince) => getOverviewActivity(failuresSince),
  getDailySeries: (input) => getExecutionDailySeries(input),
};

export const getOverviewForApi = async (
  { days, timeZone, now }: OverviewApiInput,
  dependencies: OverviewApiDependencies = defaultDependencies,
) => {
  const currentWindowStart = new Date(now.getTime() - DAY_MILLISECONDS);
  const previousWindowStart = new Date(now.getTime() - 2 * DAY_MILLISECONDS);
  const failuresSince = new Date(
    now.getTime() - OVERVIEW_FAILURE_WINDOW_DAYS * DAY_MILLISECONDS,
  );
  const [last24Hours, previous24Hours, activity, daily] = await Promise.all([
    dependencies.getStatusCounts({ since: currentWindowStart }),
    dependencies.getStatusCounts({
      since: previousWindowStart,
      until: currentWindowStart,
    }),
    dependencies.getActivity(failuresSince),
    dependencies.getDailySeries({ days, timeZone, now }),
  ]);

  return {
    last24Hours,
    previous24Hours,
    failedWindowDays: OVERVIEW_FAILURE_WINDOW_DAYS,
    activity,
    daily,
  };
};
