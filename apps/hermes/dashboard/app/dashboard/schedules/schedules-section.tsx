import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { getPipelineOptionsWithValidation } from "@/lib/pipeline-options";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  getSchedulesPage,
  type ScheduleSortDir,
  type ScheduleSortField,
} from "@/lib/schedules";

import {
  SCHEDULES_DEFAULT_COLUMN_VISIBILITY,
  SCHEDULES_TABLE_ID,
} from "./schedules-table-defaults";
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
  const loadSchedulesAndPipelines = withDashboardAdmin(
    Promise.all([
      getSchedulesPage(page, pageSize, { search, sortBy, sortDir }),
      getPipelineOptionsWithValidation(),
    ]),
  );
  const [[schedulesResult, pipelineOptions], savedVisibility] =
    await Promise.all([
      loadSchedulesAndPipelines,
      readColumnVisibility(SCHEDULES_TABLE_ID),
    ]);

  return (
    <SchedulesWithModal
      schedules={schedulesResult.schedules}
      pipelines={pipelineOptions.pipelines}
      pipelineValidationById={pipelineOptions.pipelineValidationById}
      urlState={{
        basePath: "/dashboard/schedules",
        page: schedulesResult.page,
        pageSize: schedulesResult.pageSize,
        total: schedulesResult.total,
        search,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        SCHEDULES_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
