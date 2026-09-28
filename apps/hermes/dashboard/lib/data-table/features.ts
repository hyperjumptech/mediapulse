import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnHelper,
  type RowData,
} from "@tanstack/react-table";

export type DataTableBreakpoint = "sm" | "md" | "lg" | "xl";

export type DataTableMobileRole =
  | "title"
  | "subtitle"
  | "badge"
  | "field"
  | "actions"
  | "hidden";

export type DataTableColumnMeta = {
  label: string;
  sortKey?: string;
  hideBelow?: DataTableBreakpoint;
  mobile?: DataTableMobileRole;
  mobileWrap?: boolean;
  minWidth?: number;
  headerClassName?: string;
  cellClassName?: string;
};

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableSort = { id: string; desc: boolean };

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumns<Row extends RowData> = ReturnType<
  ColumnHelper<DataTableFeatures, Row>["columns"]
>;

export const createDataTableColumnHelper = <Row extends RowData>() =>
  createColumnHelper<DataTableFeatures, Row>();
