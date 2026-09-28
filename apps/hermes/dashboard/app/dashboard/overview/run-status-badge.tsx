import type { ComponentProps } from "react";

import type { ScheduleRunStatus } from "@hermes/orchestration-database";
import { Badge } from "@workspace/ui/components/badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const RUN_STATUS_BADGE_VARIANT: Record<ScheduleRunStatus, BadgeVariant> = {
  pending: "muted",
  running: "info",
  succeeded: "success",
  partial: "warning",
  failed: "destructive",
  cancelled: "muted",
};

export const RunStatusBadge = ({
  runStatus,
}: {
  runStatus: ScheduleRunStatus;
}) => {
  const variant = RUN_STATUS_BADGE_VARIANT[runStatus];

  return (
    <Badge variant={variant} className="min-w-16 capitalize">
      {runStatus}
    </Badge>
  );
};
