import {
  renderCaptionTemplate,
  renderUrlTemplate,
  resolvePath,
  type DetailBlockBadgeVariant,
  type DetailBlockSubTable,
  type DetailBlockSubTableColumn,
} from "@hermes/domain-contract";

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
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockSubTablePaginator } from "./detail-block-sub-table-paginator";
import { DetailBlockSubTableRowLimit } from "./detail-block-sub-table-row-limit";

const mapBadgeVariant = (
  variant: DetailBlockBadgeVariant,
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning" => (variant === "muted" ? "secondary" : variant);

const truncate = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

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

/**
 * Renders one row cell of a sub-table column. Handles `linkTemplate`,
 * `truncate`, `type: "badge"` (with optional `inconsistentField` marker),
 * and `copyAction`.
 */
export const DetailBlockSubTableCell = ({
  column,
  row,
  rowContext,
}: {
  column: DetailBlockSubTableColumn;
  row: Record<string, unknown>;
  rowContext: unknown;
}) => {
  const value = resolvePath(row, column.field);
  const text = formatCellValue(column, value);
  const truncated =
    column.truncate && text !== "—" ? truncate(text, column.truncate) : text;

  if (column.type === "badge") {
    const variant = column.badgeVariants?.[String(value)];
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
        className={nowrapClass}
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
  return (
    <span className="flex flex-col gap-0.5">
      {overlineText ? (
        <span className="text-xs text-muted-foreground">{overlineText}</span>
      ) : null}
      {primary}
      {descriptionText ? (
        <span className="text-xs text-muted-foreground">{descriptionText}</span>
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
}: {
  columns: readonly DetailBlockSubTableColumn[];
  rows: readonly Record<string, unknown>[];
  rowContext: unknown;
  hideHeader?: boolean;
}) => (
  <div className="overflow-x-auto rounded-md border">
    <Table>
      {hideHeader ? null : (
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.field}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {rows.map((row, rowIndex) => {
          const rowKey =
            typeof row.id === "string" ? row.id : `row-${rowIndex}`;
          return (
            <TableRow key={rowKey}>
              {columns.map((column) => (
                <TableCell key={`${rowKey}-${column.field}`}>
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
        <p className="text-sm text-muted-foreground">
          {block.emptyState ?? "No items."}
        </p>
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
        />
      )}
    </section>
  );
};
