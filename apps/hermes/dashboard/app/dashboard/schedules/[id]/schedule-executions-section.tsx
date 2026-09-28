import { ExecutionsDataTable } from "@/components/executions/executions-data-table";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { pipelineExecutionToListRow } from "@/lib/execution-list";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { getScheduleExecutionsPage } from "@/lib/schedules";

const SCHEDULE_EXECUTIONS_TABLE_ID = "schedule-executions";

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
  const [executionsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      executionsPage ?? getScheduleExecutionsPage(scheduleId, page, pageSize),
    ),
    readColumnVisibility(SCHEDULE_EXECUTIONS_TABLE_ID),
  ]);
  const rows = executionsResult.executions.map((execution) =>
    pipelineExecutionToListRow(execution),
  );

  return (
    <ExecutionsDataTable
      title="Executions"
      tableId={SCHEDULE_EXECUTIONS_TABLE_ID}
      rows={rows}
      omitColumns={["pipeline", "source"]}
      urlState={{
        basePath: `/dashboard/schedules/${scheduleId}`,
        page: executionsResult.page,
        pageSize: executionsResult.pageSize,
        total: executionsResult.total,
        sortDir: "desc",
      }}
      paginationLabel="Schedule executions pagination"
      emptyDescription="Each time this schedule fires, its run shows up here with job and invocation counts."
      initialColumnVisibility={savedVisibility}
    />
  );
};
