import { Suspense } from "react";
import { Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { PageHeader } from "@/components/page-header";
import { ListBodySkeleton } from "@/components/page-skeletons";
import {
  parseListPagination,
  parseListSearch,
  parseListSort,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import type { VariableSortField } from "@/lib/variables";

import { VariableModal } from "./variable-modal";
import { VariablesSection, type VariablesQuery } from "./variables-section";

const SORT_FIELDS: VariableSortField[] = ["key", "created"];

const VariablesPage = async ({
  searchParams,
}: {
  searchParams: Promise<ListPageSearchParams> | ListPageSearchParams;
}) => {
  const resolved = await Promise.resolve(searchParams);
  const query: VariablesQuery = {
    ...parseListPagination(resolved),
    ...parseListSort(resolved, SORT_FIELDS, "key"),
    search: parseListSearch(resolved),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Variables"
        description="Manage key-value variables for pipelines (secrets are masked)."
        actions={
          <VariableModal
            variable={null}
            trigger={
              <Button>
                <Plus aria-hidden />
                Add variable
              </Button>
            }
          />
        }
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListBodySkeleton />}>
        <VariablesSection {...query} />
      </Suspense>
    </div>
  );
};

export default VariablesPage;
