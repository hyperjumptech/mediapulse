"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { SearchX, Table2 } from "lucide-react";
import type {
  DashboardColumnTone,
  TableV1MetaResponse,
} from "@hermes/domain-contract";

import { cn } from "@workspace/ui/lib/utils";

import {
  DataTable,
  type DataTableEmptyState,
} from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { statusTone, ToneBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import {
  createDataTableColumnHelper,
  type DataTableColumnMeta,
  type DataTableColumns,
} from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { toValidDate } from "@/lib/date-time/format-date-time";
import {
  buildDomainTableDefaultColumnVisibility,
  buildDomainTableItemHref,
  formatDomainBoolean,
  formatDomainDuration,
  formatDomainNumber,
  humanizeDomainBadgeValue,
  isEmptyDomainCellValue,
  isNumericDomainColumnFormat,
  readDomainTableRowId,
  resolveDomainColumnFormat,
  resolveDomainColumnMobileRole,
  resolveDomainDateTimeZone,
  stringifyDomainCellValue,
  toDomainCellBoolean,
  toDomainCellNumber,
  type DomainTableColumn,
  type DomainTableRow,
} from "@/lib/domain-table-columns";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

import { DomainTableRowActions } from "./domain-table-row-actions";

export type DomainDataTableMeta = Pick<
  TableV1MetaResponse,
  "title" | "columns" | "sortableFields" | "actions" | "createNavigation"
>;

type FormAction = (formData: FormData) => Promise<void>;

type BadgeTones = DomainTableColumn["badgeTones"];

export type BuildDomainTableColumnsInput = {
  meta: Omit<DomainDataTableMeta, "title">;
  basePath: string;
  updateFields: DomainTableFormField[];
  updateAction: FormAction;
  deleteAction: FormAction;
};

const ROW_ACTIONS_COLUMN_ID = "__row-actions";

const EmptyCellValue = () => <span className="text-muted-foreground">—</span>;

const TextCellValue = ({ text }: { text: string }) => (
  <span className="block max-w-48 truncate 2xl:max-w-xs" title={text}>
    {text}
  </span>
);

const DateCellValue = ({
  value,
  format,
}: {
  value: unknown;
  format: "date-time" | "date";
}) => {
  const date = toValidDate(value);
  if (!date) {
    return <TextCellValue text={stringifyDomainCellValue(value)} />;
  }
  if (format === "date") {
    return (
      <DateTime
        value={date}
        style="date"
        timeZone={resolveDomainDateTimeZone(value)}
      />
    );
  }

  return <DateTime value={date} />;
};

const NumericCellValue = ({
  value,
  formatNumber,
}: {
  value: unknown;
  formatNumber: (value: number) => string;
}) => {
  const numericValue = toDomainCellNumber(value);
  if (numericValue === null) {
    return <TextCellValue text={stringifyDomainCellValue(value)} />;
  }

  return <span className="tabular-nums">{formatNumber(numericValue)}</span>;
};

const BooleanCellValue = ({
  value,
  badgeTones,
}: {
  value: unknown;
  badgeTones: BadgeTones;
}) => {
  const booleanValue = toDomainCellBoolean(value);
  if (booleanValue === null) {
    return <TextCellValue text={stringifyDomainCellValue(value)} />;
  }
  const label = formatDomainBoolean(booleanValue);
  const defaultTone: DashboardColumnTone = booleanValue ? "success" : "muted";
  const tone = badgeTones?.[String(booleanValue)] ?? defaultTone;

  return <ToneBadge tone={tone}>{label}</ToneBadge>;
};

const BadgeCellValue = ({
  value,
  badgeTones,
}: {
  value: unknown;
  badgeTones: BadgeTones;
}) => {
  const text = stringifyDomainCellValue(value);
  const tone = badgeTones?.[text] ?? statusTone(text);

  return (
    <ToneBadge tone={tone} className="capitalize">
      {humanizeDomainBadgeValue(text)}
    </ToneBadge>
  );
};

export const DomainTableCellValue = ({
  column,
  value,
}: {
  column: DomainTableColumn;
  value: unknown;
}) => {
  if (isEmptyDomainCellValue(value)) {
    return <EmptyCellValue />;
  }
  const format = resolveDomainColumnFormat(column);

  switch (format) {
    case "date-time":
    case "date":
      return <DateCellValue value={value} format={format} />;
    case "number":
      return (
        <NumericCellValue value={value} formatNumber={formatDomainNumber} />
      );
    case "duration-ms":
      return (
        <NumericCellValue value={value} formatNumber={formatDomainDuration} />
      );
    case "boolean":
      return <BooleanCellValue value={value} badgeTones={column.badgeTones} />;
    case "badge":
      return <BadgeCellValue value={value} badgeTones={column.badgeTones} />;
    default:
      return <TextCellValue text={stringifyDomainCellValue(value)} />;
  }
};

const DomainTableTitleCell = ({
  column,
  row,
  viewHref,
}: {
  column: DomainTableColumn;
  row: DomainTableRow;
  viewHref?: string;
}) => {
  const value = row[column.key];
  const content = <DomainTableCellValue column={column} value={value} />;
  if (!viewHref || isEmptyDomainCellValue(value)) {
    return content;
  }

  return (
    <Link
      href={viewHref}
      className="block max-w-64 truncate font-medium text-foreground underline-offset-4 hover:underline 2xl:max-w-sm"
    >
      {content}
    </Link>
  );
};

const sortKeyFor = (
  column: DomainTableColumn,
  sortableFields: readonly string[],
): string | undefined =>
  sortableFields.includes(column.key) ? column.key : undefined;

const titleColumnMeta = (
  column: DomainTableColumn,
  sortableFields: readonly string[],
): DataTableColumnMeta => ({
  label: column.label,
  sortKey: sortKeyFor(column, sortableFields),
  mobile: "title",
  cellClassName: "font-medium",
});

const valueColumnMeta = (
  column: DomainTableColumn,
  index: number,
  sortableFields: readonly string[],
): DataTableColumnMeta => {
  const isNumeric = isNumericDomainColumnFormat(
    resolveDomainColumnFormat(column),
  );

  return {
    label: column.label,
    sortKey: sortKeyFor(column, sortableFields),
    hideBelow: column.hideBelow,
    mobile: resolveDomainColumnMobileRole(column, index),
    headerClassName: isNumeric ? "text-right" : undefined,
    cellClassName: cn(
      "text-muted-foreground",
      isNumeric && "text-right tabular-nums",
    ),
  };
};

const columnHelper = createDataTableColumnHelper<DomainTableRow>();

export const buildDomainTableColumns = ({
  meta,
  basePath,
  updateFields,
  updateAction,
  deleteAction,
}: BuildDomainTableColumnsInput): DataTableColumns<DomainTableRow> => {
  const [titleColumn, ...valueColumns] = meta.columns;
  const canView = Boolean(meta.actions.view);
  const canEdit = Boolean(meta.actions.update) && updateFields.length > 0;
  const canDelete = Boolean(meta.actions.delete);
  const hasRowActions = canView || canEdit || canDelete;
  const editsOnFullPage = meta.createNavigation === "full-page" && canEdit;
  const itemHrefFor = (row: DomainTableRow) =>
    buildDomainTableItemHref(basePath, readDomainTableRowId(row));

  const titleDefinitions = titleColumn
    ? [
        columnHelper.accessor((row) => row[titleColumn.key], {
          id: titleColumn.key,
          enableHiding: false,
          meta: titleColumnMeta(titleColumn, meta.sortableFields),
          cell: ({ row }) => (
            <DomainTableTitleCell
              column={titleColumn}
              row={row.original}
              viewHref={canView ? itemHrefFor(row.original) : undefined}
            />
          ),
        }),
      ]
    : [];

  const valueDefinitions = valueColumns.map((column, valueIndex) =>
    columnHelper.accessor((row) => row[column.key], {
      id: column.key,
      meta: valueColumnMeta(column, valueIndex + 1, meta.sortableFields),
      cell: ({ row }) => (
        <DomainTableCellValue
          column={column}
          value={row.original[column.key]}
        />
      ),
    }),
  );

  const rowActionDefinitions = hasRowActions
    ? [
        columnHelper.display({
          id: ROW_ACTIONS_COLUMN_ID,
          enableHiding: false,
          meta: {
            label: "Actions",
            mobile: "actions",
            cellClassName: "pr-2 text-right",
          },
          cell: ({ row }) => {
            const itemHref = itemHrefFor(row.original);

            return (
              <DomainTableRowActions
                rowId={readDomainTableRowId(row.original)}
                row={row.original}
                updateFields={updateFields}
                updateAction={updateAction}
                deleteAction={deleteAction}
                showEdit={canEdit}
                showDelete={canDelete}
                editHref={editsOnFullPage ? `${itemHref}/edit` : undefined}
                showView={canView}
                viewHref={canView ? itemHref : undefined}
              />
            );
          },
        }),
      ]
    : [];

  return columnHelper.columns([
    ...titleDefinitions,
    ...valueDefinitions,
    ...rowActionDefinitions,
  ]);
};

const buildDomainTableEmptyState = (
  title: string,
  hasActiveFilters: boolean,
): DataTableEmptyState => {
  const lowercaseTitle = title.toLowerCase();
  if (hasActiveFilters) {
    return {
      icon: SearchX,
      title: `No matching ${lowercaseTitle}`,
      description: "Try a different search or clear the filters.",
    };
  }

  return { icon: Table2, title: `No ${lowercaseTitle} yet` };
};

export type DomainDataTableProps = {
  tableId: string;
  basePath: string;
  meta: DomainDataTableMeta;
  rows: DomainTableRow[];
  urlState: ListUrlState;
  updateFields: DomainTableFormField[];
  updateAction: FormAction;
  deleteAction: FormAction;
  toolbarFilters?: ReactNode;
  toolbarActions?: ReactNode;
  initialColumnVisibility?: ColumnVisibility;
};

export const DomainDataTable = ({
  tableId,
  basePath,
  meta,
  rows,
  urlState,
  updateFields,
  updateAction,
  deleteAction,
  toolbarFilters,
  toolbarActions,
  initialColumnVisibility,
}: DomainDataTableProps) => {
  const columns = useMemo(
    () =>
      buildDomainTableColumns({
        meta,
        basePath,
        updateFields,
        updateAction,
        deleteAction,
      }),
    [meta, basePath, updateFields, updateAction, deleteAction],
  );
  const hasActiveFilters = Object.keys(urlState.extra ?? {}).length > 0;
  const lowercaseTitle = meta.title.toLowerCase();

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      rows={rows}
      getRowId={readDomainTableRowId}
      urlState={urlState}
      paginationLabel={`${meta.title} list pagination`}
      search={{
        label: `Search ${meta.title}`,
        placeholder: `Filter ${lowercaseTitle}…`,
      }}
      toolbarFilters={toolbarFilters}
      toolbarActions={toolbarActions}
      emptyState={buildDomainTableEmptyState(meta.title, hasActiveFilters)}
      initialColumnVisibility={
        initialColumnVisibility ??
        buildDomainTableDefaultColumnVisibility(meta.columns)
      }
    />
  );
};
