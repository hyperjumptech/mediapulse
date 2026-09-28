import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";
import {
  parseListPagination,
  parseListSearch,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import type { ScheduleSortField } from "@/lib/schedules";

import { SchedulesSection, type SchedulesQuery } from "./schedules-section";

const SORT_FIELDS: ScheduleSortField[] = [
  "name",
  "nextRunAt",
  "created",
  "enabled",
];

const SchedulesPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: SchedulesQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "name"),
    search: parseListSearch(resolved),
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Schedules"
        description="Schedule pipelines to run on a cron or interval."
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListBodySkeleton />}>
        <SchedulesSection {...query} />
      </Suspense>
    </div>
  );
};

export default SchedulesPage;
