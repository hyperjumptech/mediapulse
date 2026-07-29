import {
  renderCaptionTemplate,
  renderUrlTemplate,
  resolvePath,
  type DetailBlockBadgeVariant,
  type DetailBlockSubTable,
  type DetailBlockSubTableColumn,
  type DetailBlockSubTableListItem,
} from "@hermes/domain-contract";

import { ChevronDown } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DetailBlockCopyButton } from "./detail-block-copy-button";
import { DetailBlockEmptyState } from "./detail-block-empty-state";
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockSubTablePaginator } from "./detail-block-sub-table-paginator";
import { DetailBlockSubTableRowLimit } from "./detail-block-sub-table-row-limit";
import { mapBadgeVariant } from "./map-badge-variant";

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
    if (typeof value === "string" || value instanceof Date) {
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return String(value);
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
  1: "grid-cols-1",
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
        <a
          href={url}
          target={column.linkExternal === true ? "_blank" : undefined}
          rel={column.linkExternal === true ? "noopener noreferrer" : undefined}
          className="underline-offset-4 hover:underline"
        >
          {headingText}
        </a>
      ) : (
        headingText
      )}
    </div>
  );
};

/**
 * Renders one row cell of a sub-table column, wrapping the value in a heading band when the column
 * declares a `headingField`.
 */
export const DetailBlockSubTableCell = (props: {
  column: DetailBlockSubTableColumn;
  row: Record<string, unknown>;
  rowContext: unknown;
}) => {
  const heading = renderCellHeading(props.column, props.row, props.rowContext);
  if (heading === null) return <DetailBlockSubTableCellBody {...props} />;

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

/**
 * Renders the value of one sub-table cell. Handles `linkTemplate`, `truncate`, `type: "badge"`
 * (with optional `inconsistentField` marker), `type: "list"` (stacked entries from an array
 * field), and `copyAction`.
 */
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
        className={`grid gap-x-8 gap-y-2.5 ${LIST_GRID_CLASS[perRow] ?? ""}`}
      >
        {renderedEntries}
      </div>
    );
  }

  const text = formatCellValue(column, value);
  const truncated =
    column.truncate && text !== "—" ? truncate(text, column.truncate) : text;

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
          <Badge variant={mapBadgeVariant(variant)}>{text}</Badge>
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
  const nowrapClass = column.noWrap === true ? "whitespace-nowrap" : undefined;
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
      <a
        href={url}
        target={column.linkExternal === true ? "_blank" : undefined}
        rel={column.linkExternal === true ? "noopener noreferrer" : undefined}
        className={["text-primary underline underline-offset-4", nowrapClass]
          .filter(Boolean)
          .join(" ")}
        title={text.length > truncated.length ? text : undefined}
      >
        {truncated}
      </a>
    ) : (
      <span
        className={
          [nowrapClass, mutedClass, colorClass].filter(Boolean).join(" ") ||
          undefined
        }
        title={text.length > truncated.length ? text : undefined}
      >
        {truncated}
      </span>
    );
  const primary = (
    <span className="inline-flex items-center gap-2">
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
          <a
            href={descriptionUrl}
            target={column.linkExternal === true ? "_blank" : undefined}
            rel={
              column.linkExternal === true ? "noopener noreferrer" : undefined
            }
            className="text-primary text-sm font-normal underline underline-offset-4"
          >
            {descriptionText}
          </a>
        ) : (
          <span className="text-muted-foreground text-sm font-normal">
            {descriptionText}
          </span>
        )
      ) : null}
    </span>
  );
};

/**
 * Renders a static (non-paginated) sub-table given pre-sliced rows and the
 * manifest columns. Shared by {@link DetailBlockSubTableView} and the client
 * paginator.
 */
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
}) => (
  <div className="overflow-x-auto rounded-md border">
    <Table>
      {hideHeader ? null : (
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.field}
                style={
                  column.minWidth ? { minWidth: column.minWidth } : undefined
                }
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {rows.map((row, rowIndex) => {
          const rowKey =
            typeof row.id === "string" ? row.id : `row-${rowIndex}`;
          const isSectionHeader =
            sectionHeaderField !== undefined &&
            Boolean(resolvePath(row, sectionHeaderField));
          if (isSectionHeader) {
            const headerColumn = columns[0];
            const headerText = headerColumn
              ? String(resolvePath(row, headerColumn.field) ?? "")
              : "";
            return (
              <TableRow key={rowKey} className="bg-muted/50">
                <TableCell
                  colSpan={columns.length}
                  className="text-foreground font-semibold"
                >
                  {headerText}
                </TableCell>
              </TableRow>
            );
          }
          return (
            <TableRow key={rowKey}>
              {columns.map((column) => (
                <TableCell
                  key={`${rowKey}-${column.field}`}
                  style={
                    column.minWidth ? { minWidth: column.minWidth } : undefined
                  }
                >
                  <DetailBlockSubTableCell
                    column={column}
                    row={row}
                    rowContext={rowContext}
                  />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

/**
 * Renders a `subTable` detail block — columns from the manifest, rows from a
 * named array field on the detail response. Supports an optional caption
 * template, an empty-state string, an optional hidden header, and client-side
 * pagination when `pageSize` is set (and the row count exceeds it).
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
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
    <section className="flex flex-col gap-3">
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
