import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import {
  getHttpTriggersPage,
  type HttpTriggerSortDir,
  type HttpTriggerSortField,
} from "@/lib/http-triggers";
import { getPipelineOptions } from "@/lib/pipeline-options";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  HTTP_TRIGGERS_DEFAULT_COLUMN_VISIBILITY,
  HTTP_TRIGGERS_TABLE_ID,
} from "./http-triggers-table-defaults";
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
  const loadTriggersAndPipelines = withDashboardAdmin(
    Promise.all([
      getHttpTriggersPage(page, pageSize, { search, sortBy, sortDir }),
      getPipelineOptions(),
    ]),
  );
  const [[triggersResult, pipelines], savedVisibility] = await Promise.all([
    loadTriggersAndPipelines,
    readColumnVisibility(HTTP_TRIGGERS_TABLE_ID),
  ]);

  return (
    <HttpTriggersWithModal
      httpTriggers={triggersResult.httpTriggers}
      pipelines={pipelines}
      urlState={{
        basePath: "/dashboard/http-triggers",
        page: triggersResult.page,
        pageSize: triggersResult.pageSize,
        total: triggersResult.total,
        search,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        HTTP_TRIGGERS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
