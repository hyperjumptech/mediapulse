import { ExecutionsDataTable } from "@/components/executions/executions-data-table";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { pipelineExecutionToListRow } from "@/lib/execution-list";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

const PIPELINE_EXECUTIONS_TABLE_ID = "pipeline-executions";

export type PipelineExecutionsSectionProps = {
  pipelineId: string;
  page: number;
  pageSize: number;
  executionsPage?: ReturnType<typeof getPipelineExecutionsPage>;
};

export const PipelineExecutionsSection = async ({
  pipelineId,
  page,
  pageSize,
  executionsPage,
}: PipelineExecutionsSectionProps) => {
  const [executionsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      executionsPage ?? getPipelineExecutionsPage(pipelineId, page, pageSize),
    ),
    readColumnVisibility(PIPELINE_EXECUTIONS_TABLE_ID),
  ]);
  const rows = executionsResult.executions.map((execution) =>
    pipelineExecutionToListRow(execution),
  );

  return (
    <ExecutionsDataTable
      title="Executions"
      tableId={PIPELINE_EXECUTIONS_TABLE_ID}
      rows={rows}
      omitColumns={["pipeline"]}
      urlState={{
        basePath: `/dashboard/pipelines/${pipelineId}`,
        page: executionsResult.page,
        pageSize: executionsResult.pageSize,
        total: executionsResult.total,
        sortDir: "desc",
      }}
      paginationLabel="Pipeline executions pagination"
      emptyDescription="Runs from this pipeline's schedules, HTTP triggers and manual runs show up here."
      initialColumnVisibility={savedVisibility}
    />
  );
};
