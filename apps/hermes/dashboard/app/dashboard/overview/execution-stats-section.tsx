import { subHours } from "date-fns";

import { Card } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";

import { getExecutionStatusCounts } from "@/lib/dashboard-overview";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

const ExecutionStatCard = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) => {
  return (
    <Card className="min-w-0 gap-1 px-4 py-3 shadow-none">
      <dt className="truncate text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </Card>
  );
};

export const ExecutionStatsSection = async () => {
  const since = subHours(new Date(), 24);
  const counts = await withDashboardAdmin(getExecutionStatusCounts(since));
  const failedValueClassName =
    counts.failed > 0 ? "text-destructive dark:text-red-400" : undefined;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ExecutionStatCard label="Runs in the last 24h" value={counts.total} />
      <ExecutionStatCard label="Running now" value={counts.running} />
      <ExecutionStatCard label="Succeeded" value={counts.succeeded} />
      <ExecutionStatCard
        label="Failed"
        value={counts.failed}
        valueClassName={failedValueClassName}
      />
    </dl>
  );
};
