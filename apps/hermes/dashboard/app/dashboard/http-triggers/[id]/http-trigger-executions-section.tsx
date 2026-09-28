import { ListPagination } from "@/components/list-pagination";
import { getHttpTriggerExecutionsPage } from "@/lib/http-triggers";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { ExecutionsTable } from "./executions-table";

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
  const executionsResult = await withDashboardAdmin(
    executionsPage ?? getHttpTriggerExecutionsPage(triggerId, page, pageSize),
  );

  return (
    <>
      <ExecutionsTable
        triggerId={triggerId}
        executions={executionsResult.executions}
      />
      <div className="mt-4">
        <ListPagination
          basePath={`/dashboard/http-triggers/${triggerId}`}
          page={executionsResult.page}
          pageSize={executionsResult.pageSize}
          total={executionsResult.total}
          ariaLabel="HTTP trigger executions pagination"
        />
      </div>
    </>
  );
};
