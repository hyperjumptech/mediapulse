import { Suspense } from "react";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";
import { ListBodySkeleton } from "@/components/page-skeletons";
import {
  parseListPagination,
  parseListSearch,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import type { PipelineSortField } from "@/lib/pipeline-summaries";

import { PipelinesSection, type PipelinesQuery } from "./pipelines-section";

const SORT_FIELDS: PipelineSortField[] = ["name", "updated"];

const PipelinesPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: PipelinesQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "updated", "desc"),
    search: parseListSearch(resolved),
  };

  return (
    <EntityFormModalProvider>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<ListBodySkeleton />}>
          <PipelinesSection {...query} />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default PipelinesPage;
