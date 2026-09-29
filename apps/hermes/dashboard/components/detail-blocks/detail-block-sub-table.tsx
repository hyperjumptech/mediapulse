"use client";

import {
  renderCaptionTemplate,
  renderUrlTemplate,
  resolvePath,
  type DetailBlockBadgeVariant,
  type DetailBlockSubTable,
  type DetailBlockSubTableColumn,
  type DetailBlockSubTableListItem,
} from "@hermes/domain-contract";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ChevronDown, Inbox } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { ToneBadge } from "@/components/status-badge";
import {
  createDataTableColumnHelper,
  type DataTableMobileRole,
} from "@/lib/data-table/features";
import { toValidDate } from "@/lib/date-time/format-date-time";

import { DetailBlockCopyButton } from "./detail-block-copy-button";
import { DetailBlockEmptyState } from "./detail-block-empty-state";
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockSubTablePaginator } from "./detail-block-sub-table-paginator";
import { DetailBlockSubTableRowLimit } from "./detail-block-sub-table-row-limit";
import { mapBadgeTone } from "./map-badge-variant";

const truncate = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

const TEXT_COLOR_BY_VARIANT: Record<string, string> = {
  success: "text-green-600 dark:text-green-500",
  warning: "text-amber-600 dark:text-amber-500",
  destructive: "text-red-600 dark:text-red-500",
  muted: "text-muted-foreground",
};

const formatCellValue = (
  column: DetailBlockSubTableColumn,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "date-time") {
    const date = toValidDate(value);

    return date ? date.toISOString() : String(value);
  }
  if (column.type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString();
    }
    return String(value);
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const renderCellText = (
  column: DetailBlockSubTableColumn,
  value: unknown,
  text: string,
): ReactNode => {
  const date = column.type === "date-time" ? toValidDate(value) : null;

  return date ? <DateTime value={date} /> : text;
};

const listItemColumn = (
  column: DetailBlockSubTableColumn,
  item: DetailBlockSubTableListItem,
  withDescription: boolean,
): DetailBlockSubTableColumn => ({
  field: item.field,
  label: column.label,
  type: "text",
  ...(item.colorField !== undefined ? { colorField: item.colorField } : {}),
  ...(withDescription && item.descriptionField !== undefined
    ? { descriptionField: item.descriptionField }
    : {}),
  ...(item.overlineField !== undefined
    ? { overlineField: item.overlineField }
    : {}),
  ...(item.truncate !== undefined ? { truncate: item.truncate } : {}),
  ...(item.muted !== undefined ? { muted: item.muted } : {}),
});

const asRow = (entry: unknown): Record<string, unknown> =>
  typeof entry === "object" && entry !== null
    ? (entry as Record<string, unknown>)
    : {};

const LIST_GRID_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const withoutLink = (
  column: DetailBlockSubTableColumn,
): DetailBlockSubTableColumn => {
  const next = { ...column };
  delete next.linkTemplate;
  delete next.linkExternal;

  return next;
};

const isInternalHref = (href: string): boolean =>
  href.startsWith("/") && !href.startsWith("//");

const DetailBlockSubTableLink = ({
  href,
  external,
  className,
  title,
  children,
}: {
  href: string;
  external: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) => {
  const target = external ? "_blank" : undefined;
  const rel = external ? "noopener noreferrer" : undefined;

  if (isInternalHref(href)) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={className}
        title={title}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      title={title}
    >
      {children}
    </a>
  );
};

const renderCellHeading = (
  column: DetailBlockSubTableColumn,
  row: Record<string, unknown>,
  rowContext: unknown,
) => {
  if (column.headingField === undefined) return null;
  const headingValue = resolvePath(row, column.headingField);
  const headingText = formatCellValue(column, headingValue);
  const url = column.linkTemplate
    ? renderUrlTemplate(column.linkTemplate, {
        ...(typeof rowContext === "object" && rowContext !== null
          ? (rowContext as Record<string, unknown>)
          : {}),
        ...row,
        row: rowContext,
      })
    : undefined;

  return (
    <div className="bg-muted/50 text-foreground -mx-2 -mt-2 border-b px-2 py-2 font-semibold">
      {url && headingText !== "—" ? (
        <DetailBlockSubTableLink
          href={url}
          external={column.linkExternal === true}
          className="underline-offset-4 hover:underline"
        >
          {renderCellText(column, headingValue, headingText)}
        </DetailBlockSubTableLink>
      ) : (
        renderCellText(column, headingValue, headingText)
      )}
    </div>
  );
};

export const DetailBlockSubTableCell = (props: {
  column: DetailBlockSubTableColumn;
  row: Record<string, unknown>;
  rowContext: unknown;
}) => {
  const heading = renderCellHeading(props.column, props.row, props.rowContext);
  const isBullet =
    props.column.bulletField !== undefined &&
    Boolean(resolvePath(props.row, props.column.bulletField));

  if (heading === null) {
    if (!isBullet) return <DetailBlockSubTableCellBody {...props} />;

    return (
      <span className="flex gap-2 pl-4">
        <span aria-hidden="true" className="text-muted-foreground select-none">
          •
        </span>
        <DetailBlockSubTableCellBody {...props} />
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {heading}
      <DetailBlockSubTableCellBody
        {...props}
        column={withoutLink(props.column)}
      />
    </div>
  );
};

const DetailBlockSubTableCellBody = ({
  column,
  row,
  rowContext,
}: {
  column: DetailBlockSubTableColumn;
  row: Record<string, unknown>;
  rowContext: unknown;
}) => {
  const value = resolvePath(row, column.field);

  if (column.type === "list") {
    const entries = Array.isArray(value) ? value : [];
    const item = column.listItem;
    if (item === undefined || entries.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    const collapsible =
      item.collapsible === true && item.descriptionField !== undefined;
    const entryColumn = listItemColumn(column, item, !collapsible);
    const perRow = column.listColumns ?? 1;

    const renderedEntries = entries.map((entry, index) => {
      const entryRow = asRow(entry);
      const emphasised =
        item.emphasisField !== undefined &&
        Boolean(resolvePath(entryRow, item.emphasisField));
      const summary = (
        <DetailBlockSubTableCell
          column={entryColumn}
          row={entryRow}
          rowContext={rowContext}
        />
      );
      const descriptionText =
        collapsible && item.descriptionField !== undefined
          ? resolvePath(entryRow, item.descriptionField)
          : undefined;

      return (
        <div
          key={index}
          className={[
            index >= perRow ? "border-border/60 border-t pt-2.5" : undefined,
            emphasised ? "font-bold" : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {typeof descriptionText === "string" && descriptionText.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                {summary}
                <ChevronDown
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="text-muted-foreground mt-1 text-sm font-normal whitespace-pre-line">
                {descriptionText}
              </div>
            </details>
          ) : (
            summary
          )}
        </div>
      );
    });

    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-x-8 gap-y-2.5",
          LIST_GRID_CLASS[perRow],
        )}
      >
        {renderedEntries}
      </div>
    );
  }

  const text = formatCellValue(column, value);
  const truncated =
    column.truncate && text !== "—" ? truncate(text, column.truncate) : text;
  const cellText = renderCellText(column, value, truncated);

  if (column.type === "badge") {
    const variant = column.badgeVariantField
      ? (resolvePath(row, column.badgeVariantField) as
          | DetailBlockBadgeVariant
          | undefined)
      : column.badgeVariants?.[String(value)];
    const inconsistent = column.inconsistentField
      ? Boolean(resolvePath(row, column.inconsistentField))
      : false;
    return (
      <span className="flex items-center gap-1">
        {variant ? (
          <ToneBadge tone={mapBadgeTone(variant)}>{text}</ToneBadge>
        ) : (
          <span>{text}</span>
        )}
        {inconsistent ? (
          <span
            aria-label="Inconsistent — checkpoint missing despite success outcome"
            title="Inconsistent — checkpoint missing despite success outcome"
            className="text-amber-600"
          >
            !
          </span>
        ) : null}
      </span>
    );
  }

  const url = column.linkTemplate
    ? renderUrlTemplate(column.linkTemplate, {
        ...(typeof rowContext === "object" && rowContext !== null
          ? (rowContext as Record<string, unknown>)
          : {}),
        ...row,
        row: rowContext,
      })
    : undefined;
  const nowrapClass =
    column.noWrap === true ? "md:whitespace-nowrap" : undefined;
  const mutedClass =
    column.muted === true ? "text-muted-foreground" : undefined;
  const colorVariant = column.colorField
    ? resolvePath(row, column.colorField)
    : undefined;
  const colorClass =
    typeof colorVariant === "string"
      ? TEXT_COLOR_BY_VARIANT[colorVariant]
      : undefined;
  const node =
    url && text !== "—" ? (
      <DetailBlockSubTableLink
        href={url}
        external={column.linkExternal === true}
        className={["text-primary underline underline-offset-4", nowrapClass]
          .filter(Boolean)
          .join(" ")}
        title={text.length > truncated.length ? text : undefined}
      >
        {cellText}
      </DetailBlockSubTableLink>
    ) : (
      <span
        className={
          [nowrapClass, mutedClass, colorClass].filter(Boolean).join(" ") ||
          undefined
        }
        title={text.length > truncated.length ? text : undefined}
      >
        {cellText}
      </span>
    );
  const primary = (
    <span className="inline-flex max-w-full items-center gap-1">
      {node}
      {column.copyAction === true &&
      typeof value === "string" &&
      value.length > 0 ? (
        <DetailBlockCopyButton value={value} label={`Copy ${column.label}`} />
      ) : null}
    </span>
  );

  const stackedFieldValue = (field: string | undefined): string | undefined => {
    if (field === undefined) return undefined;
    const resolved = resolvePath(row, field);
    return typeof resolved === "string" && resolved.length > 0
      ? resolved
      : undefined;
  };
  const overlineText = stackedFieldValue(column.overlineField);
  const descriptionText = stackedFieldValue(column.descriptionField);
  if (overlineText === undefined && descriptionText === undefined) {
    return primary;
  }
  const descriptionUrl =
    descriptionText !== undefined && column.descriptionLinkTemplate
      ? renderUrlTemplate(column.descriptionLinkTemplate, {
          ...(typeof rowContext === "object" && rowContext !== null
            ? (rowContext as Record<string, unknown>)
            : {}),
          ...row,
          row: rowContext,
        })
      : undefined;
  return (
    <span className="flex flex-col gap-0.5">
      {overlineText ? (
        <span className="text-muted-foreground text-xs font-normal">
          {overlineText}
        </span>
      ) : null}
      {primary}
      {descriptionText ? (
        descriptionUrl ? (
          <DetailBlockSubTableLink
            href={descriptionUrl}
            external={column.linkExternal === true}
            className="text-primary text-sm font-normal underline underline-offset-4"
          >
            {descriptionText}
          </DetailBlockSubTableLink>
        ) : (
          <span className="text-muted-foreground text-sm font-normal">
            {descriptionText}
          </span>
        )
      ) : null}
    </span>
  );
};

type SubTableRow = {
  rowKey: string;
  values: Record<string, unknown>;
};

const SUB_TABLE_ID = "detail-block-sub-table";

const subTableColumnHelper = createDataTableColumnHelper<SubTableRow>();

const mobileRoleFor = (
  column: DetailBlockSubTableColumn,
  index: number,
  titleIndex: number,
): DataTableMobileRole => {
  if (column.type === "badge") return "badge";

  return index === titleIndex ? "title" : "field";
};

const wrapsTextOnDesktop = (column: DetailBlockSubTableColumn): boolean =>
  column.noWrap !== true && (column.type === "text" || column.type === "list");

const spansFullWidthOnMobile = (column: DetailBlockSubTableColumn): boolean =>
  column.type === "list" ||
  column.descriptionField !== undefined ||
  column.overlineField !== undefined ||
  column.linkTemplate !== undefined;

const buildSubTableColumns = (
  columns: readonly DetailBlockSubTableColumn[],
  rowContext: unknown,
) => {
  const titleIndex = columns.findIndex((column) => column.type !== "badge");

  return subTableColumnHelper.columns(
    columns.map((column, index) =>
      subTableColumnHelper.display({
        id: `${String(index)}:${column.field}`,
        enableHiding: false,
        meta: {
          label: column.label,
          mobile: mobileRoleFor(column, index, titleIndex),
          mobileWrap: index === titleIndex || spansFullWidthOnMobile(column),
          minWidth: column.minWidth,
          cellClassName: wrapsTextOnDesktop(column)
            ? "whitespace-normal"
            : undefined,
        },
        cell: ({ row }) => (
          <DetailBlockSubTableCell
            column={column}
            row={row.original.values}
            rowContext={rowContext}
          />
        ),
      }),
    ),
  );
};

const toSubTableRows = (
  rows: readonly Record<string, unknown>[],
): SubTableRow[] =>
  rows.map((values, index) => ({
    rowKey: typeof values.id === "string" ? values.id : `row-${String(index)}`,
    values,
  }));

const sectionHeadingReader = (
  columns: readonly DetailBlockSubTableColumn[],
  sectionHeaderField: string | undefined,
) => {
  if (sectionHeaderField === undefined) return undefined;
  const headerColumn = columns[0];

  return (row: SubTableRow): string | null => {
    if (!resolvePath(row.values, sectionHeaderField)) return null;

    return headerColumn
      ? String(resolvePath(row.values, headerColumn.field) ?? "")
      : "";
  };
};

export const DetailBlockSubTableContent = ({
  columns,
  rows,
  rowContext,
  hideHeader,
  sectionHeaderField,
}: {
  columns: readonly DetailBlockSubTableColumn[];
  rows: readonly Record<string, unknown>[];
  rowContext: unknown;
  hideHeader?: boolean;
  sectionHeaderField?: string;
}) => {
  const tableColumns = useMemo(
    () => buildSubTableColumns(columns, rowContext),
    [columns, rowContext],
  );
  const tableRows = useMemo(() => toSubTableRows(rows), [rows]);
  const getSectionHeading = useMemo(
    () => sectionHeadingReader(columns, sectionHeaderField),
    [columns, sectionHeaderField],
  );

  return (
    <DataTable
      tableId={SUB_TABLE_ID}
      columns={tableColumns}
      rows={tableRows}
      getRowId={(row) => row.rowKey}
      hideHeader={hideHeader}
      getSectionHeading={getSectionHeading}
      emptyState={{ icon: Inbox, title: "No items." }}
    />
  );
};

export const DetailBlockSubTableView = ({
  block,
  data,
}: {
  block: DetailBlockSubTable;
  data: unknown;
}) => {
  const raw = resolvePath(data, block.field);
  const rows = Array.isArray(raw)
    ? raw.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null,
      )
    : [];
  const caption = block.captionTemplate
    ? renderCaptionTemplate(block.captionTemplate, data)
    : undefined;
  if (block.rowLimitOptions !== undefined) {
    return (
      <DetailBlockSubTableRowLimit
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
        columns={block.columns}
        rows={rows}
        rowContext={data}
        emptyState={block.emptyState}
        hideHeader={block.hideHeader}
        options={block.rowLimitOptions}
        defaultAll={block.rowLimitDefaultAll}
      />
    );
  }
  const shouldPaginate =
    typeof block.pageSize === "number" && rows.length > block.pageSize;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      {caption ? (
        <p className="text-xs text-muted-foreground">{caption}</p>
      ) : null}
      {rows.length === 0 ? (
        <DetailBlockEmptyState message={block.emptyState ?? "No items."} />
      ) : shouldPaginate ? (
        <DetailBlockSubTablePaginator
          columns={block.columns}
          rows={rows}
          rowContext={data}
          pageSize={block.pageSize as number}
        />
      ) : (
        <DetailBlockSubTableContent
          columns={block.columns}
          rows={rows}
          rowContext={data}
          hideHeader={block.hideHeader}
          sectionHeaderField={block.sectionHeaderField}
        />
      )}
    </section>
  );
};
