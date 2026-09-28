export const OVERVIEW_ACTIVITY_VIEWS = [
  "running",
  "failed",
  "upcoming",
] as const;

export type OverviewActivityView = (typeof OVERVIEW_ACTIVITY_VIEWS)[number];

export const OVERVIEW_FAILURE_WINDOW_DAYS = 7;

export const OVERVIEW_ACTIVITY_VIEW_LABELS: Record<
  OverviewActivityView,
  string
> = {
  running: "Running",
  failed: `Failed (${OVERVIEW_FAILURE_WINDOW_DAYS}d)`,
  upcoming: "Upcoming",
};

export const OVERVIEW_ACTIVITY_TABLE_IDS: Record<OverviewActivityView, string> =
  {
    running: "overview-running",
    failed: "overview-failed",
    upcoming: "overview-upcoming",
  };

export const isOverviewActivityView = (
  value: string,
): value is OverviewActivityView =>
  (OVERVIEW_ACTIVITY_VIEWS as readonly string[]).includes(value);

export const formatActivityCount = (
  count: number,
  hasMore: boolean,
): string | null => {
  if (count === 0) {
    return null;
  }

  return hasMore ? `${count}+` : String(count);
};
