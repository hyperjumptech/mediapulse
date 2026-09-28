import { ExecutionsDataTable } from "@/components/executions/executions-data-table";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { pipelineExecutionToListRow } from "@/lib/execution-list";
import { getHttpTriggerExecutionsPage } from "@/lib/http-triggers";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

const HTTP_TRIGGER_EXECUTIONS_TABLE_ID = "http-trigger-executions";

export type HttpTriggerExecutionsSectionProps = {
  triggerId: string;
  page: number;
  pageSize: number;
  executionsPage?: ReturnType<typeof getHttpTriggerExecutionsPage>;
};

export const HttpTriggerExecutionsSection = async ({
  triggerId,
  page,
  pageSize,
  executionsPage,
}: HttpTriggerExecutionsSectionProps) => {
  const [executionsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      executionsPage ?? getHttpTriggerExecutionsPage(triggerId, page, pageSize),
    ),
    readColumnVisibility(HTTP_TRIGGER_EXECUTIONS_TABLE_ID),
  ]);
  const rows = executionsResult.executions.map((execution) =>
    pipelineExecutionToListRow(execution),
  );

  return (
    <ExecutionsDataTable
      title="Executions"
      tableId={HTTP_TRIGGER_EXECUTIONS_TABLE_ID}
      rows={rows}
      omitColumns={["pipeline", "source"]}
      urlState={{
        basePath: `/dashboard/http-triggers/${triggerId}`,
        page: executionsResult.page,
        pageSize: executionsResult.pageSize,
        total: executionsResult.total,
        sortDir: "desc",
      }}
      paginationLabel="HTTP trigger executions pagination"
      emptyDescription="Each call to this trigger's invoke URL starts a run that shows up here."
      initialColumnVisibility={savedVisibility}
    />
  );
};
