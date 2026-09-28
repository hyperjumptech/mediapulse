import { Button } from "@workspace/ui/components/button";

import { ListPagination } from "@/components/list-pagination";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  getVariablesPage,
  type VariableSortDir,
  type VariableSortField,
} from "@/lib/variables";

import { VariableModal } from "./variable-modal";
import { VariablesSearch } from "./variables-search";
import { VariablesTableWithEdit } from "./variables-table-with-edit";

export type VariablesQuery = {
  page: number;
  pageSize: number;
  search: string | undefined;
  sortBy: VariableSortField;
  sortDir: VariableSortDir;
};

export const VariablesSection = async ({
  page,
  pageSize,
  search,
  sortBy,
  sortDir,
}: VariablesQuery) => {
  const variablesResult = await withDashboardAdmin(
    getVariablesPage(page, pageSize, { search, sortBy, sortDir }),
  );

  return (
    <>
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <VariablesSearch
          initialQuery={search ?? ""}
          pageSize={variablesResult.pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <div className="shrink-0 sm:ml-auto">
          <VariableModal
            variable={null}
            trigger={<Button>Add variable</Button>}
          />
        </div>
      </div>
      <VariablesTableWithEdit
        variables={variablesResult.variables}
        sortBy={sortBy}
        sortDir={sortDir}
        pageSize={variablesResult.pageSize}
        searchQuery={search}
      />
      <ListPagination
        basePath="/dashboard/variables"
        page={variablesResult.page}
        pageSize={variablesResult.pageSize}
        total={variablesResult.total}
        ariaLabel="Variables list pagination"
        searchQuery={search}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </>
  );
};
