import { ListPagination } from "@/components/list-pagination";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { PipelineExecutionsTable } from "./pipeline-executions-table";

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
  const executionsResult = await withDashboardAdmin(
    executionsPage ?? getPipelineExecutionsPage(pipelineId, page, pageSize),
  );

  return (
    <div className="flex flex-col gap-3">
      <PipelineExecutionsTable
        pipelineId={pipelineId}
        executions={executionsResult.executions}
      />
      <ListPagination
        basePath={`/dashboard/pipelines/${pipelineId}`}
        page={executionsResult.page}
        pageSize={executionsResult.pageSize}
        total={executionsResult.total}
        ariaLabel="Pipeline executions pagination"
      />
    </div>
  );
};
