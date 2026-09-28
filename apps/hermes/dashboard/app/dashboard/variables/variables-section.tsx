import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  getVariablesPage,
  type VariableSortDir,
  type VariableSortField,
} from "@/lib/variables";

import { VariablesTable } from "./variables-table";
import {
  VARIABLES_DEFAULT_COLUMN_VISIBILITY,
  VARIABLES_TABLE_ID,
} from "./variables-table-defaults";

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
  const [variablesResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      getVariablesPage(page, pageSize, { search, sortBy, sortDir }),
    ),
    readColumnVisibility(VARIABLES_TABLE_ID),
  ]);

  return (
    <VariablesTable
      variables={variablesResult.variables}
      urlState={{
        basePath: "/dashboard/variables",
        page: variablesResult.page,
        pageSize: variablesResult.pageSize,
        total: variablesResult.total,
        search,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        VARIABLES_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
