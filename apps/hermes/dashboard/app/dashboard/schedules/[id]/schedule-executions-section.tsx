import { ListPagination } from "@/components/list-pagination";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { getScheduleExecutionsPage } from "@/lib/schedules";

import { ExecutionsTable } from "./executions-table";

export type ScheduleExecutionsSectionProps = {
  scheduleId: string;
  page: number;
  pageSize: number;
  executionsPage?: ReturnType<typeof getScheduleExecutionsPage>;
};

export const ScheduleExecutionsSection = async ({
  scheduleId,
  page,
  pageSize,
  executionsPage,
}: ScheduleExecutionsSectionProps) => {
  const executionsResult = await withDashboardAdmin(
    executionsPage ?? getScheduleExecutionsPage(scheduleId, page, pageSize),
  );

  return (
    <div className="flex flex-col gap-3">
      <ExecutionsTable
        scheduleId={scheduleId}
        executions={executionsResult.executions}
      />
      <ListPagination
        basePath={`/dashboard/schedules/${scheduleId}`}
        page={executionsResult.page}
        pageSize={executionsResult.pageSize}
        total={executionsResult.total}
        ariaLabel="Executions pagination"
      />
    </div>
  );
};
