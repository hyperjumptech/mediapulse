import Link from "next/link";
import { CalendarOff } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";

import {
  getUpcomingSchedules,
  type UpcomingSchedule,
} from "@/lib/dashboard-overview";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { OverviewEmptyState } from "./overview-empty-state";
import { OVERVIEW_ROW_CLASS_NAME } from "./overview-panel";
import { RelativeTime } from "./relative-time";

const UpcomingScheduleItem = ({
  schedule,
  now,
}: {
  schedule: UpcomingSchedule;
  now: Date;
}) => {
  const scheduleHref = `/dashboard/schedules/${schedule.id}`;

  return (
    <li>
      <Link href={scheduleHref} className={OVERVIEW_ROW_CLASS_NAME}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{schedule.name}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{schedule.pipeline.name}</span>
            {schedule.pipeline.isActive ? null : (
              <Badge variant="muted">Pipeline disabled</Badge>
            )}
          </span>
        </span>
        <RelativeTime date={schedule.nextRunAt} now={now} />
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
  const now = new Date();

  return (
    <ul className="flex flex-col">
      {schedules.map((schedule) => (
        <UpcomingScheduleItem key={schedule.id} schedule={schedule} now={now} />
      ))}
    </ul>
  );
};
