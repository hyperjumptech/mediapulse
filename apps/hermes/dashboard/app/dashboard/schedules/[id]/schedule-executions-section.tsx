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
    <>
      <ExecutionsTable
        scheduleId={scheduleId}
        executions={executionsResult.executions}
      />
      <div className="mt-4">
        <ListPagination
          basePath={`/dashboard/schedules/${scheduleId}`}
          page={executionsResult.page}
          pageSize={executionsResult.pageSize}
          total={executionsResult.total}
          ariaLabel="Executions pagination"
        />
      </div>
    </>
  );
};
