import {
  columnVisibilityFeature,
  createColumnHelper,
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
  headerClassName?: string;
  cellClassName?: string;
};

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumns<Row extends RowData> = ReturnType<
  ColumnHelper<DataTableFeatures, Row>["columns"]
>;

export const createDataTableColumnHelper = <Row extends RowData>() =>
  createColumnHelper<DataTableFeatures, Row>();
