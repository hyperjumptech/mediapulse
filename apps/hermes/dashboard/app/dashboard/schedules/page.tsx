import { Suspense } from "react";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";
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
    <EntityFormModalProvider>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<ListBodySkeleton />}>
          <SchedulesSection {...query} />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default SchedulesPage;
