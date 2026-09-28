import { Suspense } from "react";

import {
  EntityFormModalCreateButton,
  EntityFormModalProvider,
} from "@/components/entity-form-modal-provider";
import { PageHeader } from "@/components/page-header";
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

const SORT_FIELDS: HttpTriggerSortField[] = [
  "name",
  "method",
  "created",
  "enabled",
];

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
        <PageHeader
          title="HTTP Triggers"
          description="Run pipelines on demand through authenticated HTTP endpoints."
          actions={<EntityFormModalCreateButton label="New HTTP trigger" />}
        />
        <Suspense key={JSON.stringify(query)} fallback={<ListBodySkeleton />}>
          <HttpTriggersSection {...query} />
        </Suspense>
      </div>
    </EntityFormModalProvider>
  );
};

export default HttpTriggersPage;
