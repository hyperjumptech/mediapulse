import {
  getHttpTriggersPage,
  type HttpTriggerSortDir,
  type HttpTriggerSortField,
} from "@/lib/http-triggers";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { HttpTriggersWithModal } from "./http-triggers-with-modal";

export type HttpTriggersQuery = {
  page: number;
  pageSize: number;
  search: string | undefined;
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
};

export const HttpTriggersSection = async ({
  page,
  pageSize,
  search,
  sortBy,
  sortDir,
}: HttpTriggersQuery) => {
  const [triggersResult, pipelines] = await withDashboardAdmin(
    Promise.all([
      getHttpTriggersPage(page, pageSize, { search, sortBy, sortDir }),
      getPipelinesWithSteps(),
    ]),
  );

  return (
    <HttpTriggersWithModal
      httpTriggers={triggersResult.httpTriggers}
      pipelines={pipelines}
      currentPage={triggersResult.page}
      pageSize={triggersResult.pageSize}
      total={triggersResult.total}
      searchQuery={search}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
};
