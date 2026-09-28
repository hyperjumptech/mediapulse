import { getPipelineOptionsWithValidation } from "@/lib/pipeline-options";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  getSchedulesPage,
  type ScheduleSortDir,
  type ScheduleSortField,
} from "@/lib/schedules";

import { SchedulesWithModal } from "./schedules-with-modal";

export type SchedulesQuery = {
  page: number;
  pageSize: number;
  search: string | undefined;
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
};

export const SchedulesSection = async ({
  page,
  pageSize,
  search,
  sortBy,
  sortDir,
}: SchedulesQuery) => {
  const [schedulesResult, { pipelines, pipelineValidationById }] =
    await withDashboardAdmin(
      Promise.all([
        getSchedulesPage(page, pageSize, { search, sortBy, sortDir }),
        getPipelineOptionsWithValidation(),
      ]),
    );

  return (
    <SchedulesWithModal
      schedules={schedulesResult.schedules}
      pipelines={pipelines}
      pipelineValidationById={pipelineValidationById}
      currentPage={schedulesResult.page}
      pageSize={schedulesResult.pageSize}
      total={schedulesResult.total}
      searchQuery={search}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
};
