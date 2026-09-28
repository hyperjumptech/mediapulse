import { useTable, type RowData } from "@tanstack/react-table";
import { useCallback, useState } from "react";

import {
  COLUMN_VISIBILITY_MAX_AGE_SECONDS,
  columnVisibilityCookieName,
  serializeColumnVisibility,
  type ColumnVisibility,
} from "@/lib/data-table/column-visibility";
import {
  dataTableFeatures,
  type DataTableColumns,
} from "@/lib/data-table/features";

type Updater<Value> = Value | ((previous: Value) => Value);

const writeColumnVisibilityCookie = (
  tableId: string,
  visibility: ColumnVisibility,
) => {
  const name = columnVisibilityCookieName(tableId);
  const value = serializeColumnVisibility(visibility);
  document.cookie = `${name}=${value}; path=/; max-age=${COLUMN_VISIBILITY_MAX_AGE_SECONDS}; samesite=lax`;
};

export type UseDataTableOptions<Row extends RowData> = {
  tableId: string;
  columns: DataTableColumns<Row>;
  rows: Row[];
  getRowId: (row: Row) => string;
  initialColumnVisibility?: ColumnVisibility;
};

export const useDataTable = <Row extends RowData>({
  tableId,
  columns,
  rows,
  getRowId,
  initialColumnVisibility = {},
}: UseDataTableOptions<Row>) => {
  const [columnVisibility, setColumnVisibilityState] =
    useState<ColumnVisibility>(initialColumnVisibility);

  const setColumnVisibility = useCallback(
    (updater: Updater<ColumnVisibility>) => {
      setColumnVisibilityState((previous) => {
        const next =
          typeof updater === "function" ? updater(previous) : updater;
        writeColumnVisibilityCookie(tableId, next);

        return next;
      });
    },
    [tableId],
  );

  return useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility },
    getRowId: (row) => getRowId(row),
    onColumnVisibilityChange: setColumnVisibility,
  });
};
