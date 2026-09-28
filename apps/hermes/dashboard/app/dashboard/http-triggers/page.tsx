import { Suspense } from "react";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";
import { ListBodySkeleton } from "@/components/page-skeletons";
import type { HttpTriggerSortField } from "@/lib/http-triggers";
import {
  parseListPagination,
  parseListSearch,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";

import {
  HttpTriggersSection,
  type HttpTriggersQuery,
} from "./http-triggers-section";

const SORT_FIELDS: HttpTriggerSortField[] = ["name", "method", "enabled"];

const HttpTriggersPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: HttpTriggersQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "name"),
    search: parseListSearch(resolved),
  };

  return (
    <EntityFormModalProvider>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<ListBodySkeleton />}>
          <HttpTriggersSection {...query} />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default HttpTriggersPage;
