import Link from "next/link";
import { CalendarOff } from "lucide-react";

import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import {
  getUpcomingSchedules,
  type UpcomingSchedule,
} from "@/lib/dashboard-overview";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { OverviewEmptyState } from "./overview-empty-state";
import { OVERVIEW_ROW_CLASS_NAME } from "./overview-row";

const UpcomingScheduleItem = ({ schedule }: { schedule: UpcomingSchedule }) => {
  const scheduleHref = `/dashboard/schedules/${schedule.id}`;

  return (
    <li>
      <Link href={scheduleHref} className={OVERVIEW_ROW_CLASS_NAME}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{schedule.name}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{schedule.pipeline.name}</span>
            {schedule.pipeline.isActive ? null : (
              <StatusBadge
                status="disabled"
                label="Pipeline disabled"
                className="normal-case"
              />
            )}
          </span>
        </span>
        <DateTime
          value={schedule.nextRunAt}
          variant="both"
          className="shrink-0 text-xs text-muted-foreground"
        />
      </Link>
    </li>
  );
};

export const UpcomingSchedulesSection = async () => {
  const schedules = await withDashboardAdmin(getUpcomingSchedules());
  if (schedules.length === 0) {
    return (
      <OverviewEmptyState
        icon={CalendarOff}
        title="No upcoming runs."
        description="Enabled schedules with a next run time show up here."
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {schedules.map((schedule) => (
        <UpcomingScheduleItem key={schedule.id} schedule={schedule} />
      ))}
    </ul>
  );
};
