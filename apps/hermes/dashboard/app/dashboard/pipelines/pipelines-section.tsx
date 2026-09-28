import { prisma, type Prisma } from "@hermes/orchestration-database";

import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import {
  getPipelineSummariesPage,
  type PipelineSummariesQuery,
} from "@/lib/pipeline-summaries";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  PIPELINES_DEFAULT_COLUMN_VISIBILITY,
  PIPELINES_TABLE_ID,
} from "./pipelines-table-defaults";
import { PipelinesWithModal } from "./pipelines-with-modal";

export type PipelinesQuery = PipelineSummariesQuery;

const domainIntegrationOptionsFindManyArgs = {
  orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
  select: { id: true, integrationId: true, name: true },
} satisfies Prisma.DomainIntegrationFindManyArgs;

export const PipelinesSection = async (query: PipelinesQuery) => {
  const [[pipelinesPage, domainIntegrations], savedVisibility] =
    await Promise.all([
      withDashboardAdmin(
        Promise.all([
          getPipelineSummariesPage(query),
          prisma.domainIntegration.findMany(
            domainIntegrationOptionsFindManyArgs,
          ),
        ]),
      ),
      readColumnVisibility(PIPELINES_TABLE_ID),
    ]);
  const initialColumnVisibility = mergeColumnVisibility(
    PIPELINES_DEFAULT_COLUMN_VISIBILITY,
    savedVisibility,
  );

  return (
    <PipelinesWithModal
      pipelines={pipelinesPage.pipelines}
      urlState={{
        basePath: "/dashboard/pipelines",
        page: pipelinesPage.page,
        pageSize: pipelinesPage.pageSize,
        total: pipelinesPage.total,
        search: query.search,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      }}
      initialColumnVisibility={initialColumnVisibility}
      domainIntegrations={domainIntegrations}
    />
  );
};
