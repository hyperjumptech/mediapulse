import { format } from "date-fns";
import Link from "next/link";
import { SearchX, Table2 } from "lucide-react";
import type { TableV1MetaResponse } from "@hermes/domain-contract";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { DataTableCard } from "@/components/data-table/data-table-card";
import { ListPagination } from "@/components/list-pagination";
import { DomainTableRowActions } from "@/app/dashboard/domain-table-row-actions";
import { DomainTableSortableHeader } from "@/app/dashboard/domain-table-sortable-header";
import { getDomainTableList } from "@/lib/domain-dashboard";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";
import {
  buildDomainTableFilterExtraParams,
  type DomainTableListParamsParsed,
} from "@/lib/domain-table-list-params";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

/** Column shape from table-v1 meta (`text` or `date-time`). */
export type DomainTableColumnForDisplay = {
  key: string;
  label: string;
  type: "text" | "date-time";
};

/**
 * Formats a raw domain table cell value for display based on column type.
 *
 * Booleans render as `Yes`/`No` so domains can return raw booleans instead of
 * pre-stringified labels. `date-time` columns render like other dashboard lists
 * (e.g. `LLL d, yyyy` via date-fns). Unparseable dates fall back to the original
 * string representation.
 *
 * @param column - Column descriptor from domain table meta.
 * @param rawValue - Cell value from the list row.
 * @returns String safe to render in a table cell.
 */
export const formatDomainTableCellValue = (
  column: DomainTableColumnForDisplay,
  rawValue: unknown,
): string => {
  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }
  if (column.type !== "date-time") {
    return String(rawValue ?? "");
  }
  if (rawValue == null || rawValue === "") {
    return "";
  }
  if (rawValue instanceof Date) {
    return Number.isNaN(rawValue.getTime())
      ? ""
      : format(rawValue, "LLL d, yyyy");
  }
  if (typeof rawValue === "string" || typeof rawValue === "number") {
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime())
      ? String(rawValue)
      : format(parsed, "LLL d, yyyy");
  }
  return String(rawValue);
};

type DomainTableRowsSectionProps = {
  integrationId: string;
  resource: string;
  basePath: string;
  meta: TableV1MetaResponse;
  params: DomainTableListParamsParsed;
  updateFields: DomainTableFormField[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

const DomainTableEmptyState = ({
  title,
  isFiltered,
}: {
  title: string;
  isFiltered: boolean;
}) => {
  const lowercaseTitle = title.toLowerCase();

  if (isFiltered) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No matching {lowercaseTitle}
          </EmptyTitle>
          <EmptyDescription>
            Try a different search or clear the filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Table2 aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No {lowercaseTitle} yet</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
};

const DomainTableCellContent = ({
  text,
  isPrimary,
  viewHref,
}: {
  text: string;
  isPrimary: boolean;
  viewHref?: string;
}) => {
  if (isPrimary && viewHref && text) {
    return (
      <Link
        href={viewHref}
        className="block max-w-sm truncate font-medium text-foreground underline-offset-4 hover:underline"
        title={text}
      >
        {text}
      </Link>
    );
  }

  return (
    <div className="max-w-sm truncate" title={text || undefined}>
      {text}
    </div>
  );
};

export const DomainTableRowsSection = async ({
  integrationId,
  resource,
  basePath,
  meta,
  params,
  updateFields,
  updateAction,
  deleteAction,
}: DomainTableRowsSectionProps) => {
  const list = await withDashboardAdmin(
    getDomainTableList(integrationId, resource, params),
  );
  const filterExtraParams = buildDomainTableFilterExtraParams(params.filters);
  const hasRowActions =
    meta.actions.update || meta.actions.delete || meta.actions.view;
  const fullPage = meta.createNavigation === "full-page";
  const hasActiveFilters = Object.keys(filterExtraParams).length > 0;
  const isFiltered = Boolean(params.query) || hasActiveFilters;

  return (
    <>
      <DataTableCard>
        {list.items.length === 0 ? (
          <DomainTableEmptyState title={meta.title} isFiltered={isFiltered} />
        ) : (
          <Table>
            <DomainTableSortableHeader
              columns={meta.columns}
              sortableFields={meta.sortableFields}
              sortBy={params.sortBy}
              sortDir={params.sortDir}
              basePath={basePath}
              pageSize={params.pageSize}
              searchQuery={params.query}
              preserveParams={filterExtraParams}
              hasRowActions={hasRowActions}
            />
            <TableBody>
              {list.items.map((item) => {
                const row = item as Record<string, unknown>;
                const rowId = String(row.id ?? "");
                const encodedRowId = encodeURIComponent(rowId);
                const canEdit =
                  Boolean(meta.actions.update) && updateFields.length > 0;
                const editHref =
                  fullPage && canEdit
                    ? `${basePath}/${encodedRowId}/edit`
                    : undefined;
                const viewHref = meta.actions.view
                  ? `${basePath}/${encodedRowId}`
                  : undefined;

                return (
                  <TableRow key={rowId}>
                    {meta.columns.map((column, columnIndex) => {
                      const isPrimary = columnIndex === 0;
                      const text = formatDomainTableCellValue(
                        column,
                        row[column.key],
                      );
                      const cellClassName = cn(
                        isPrimary
                          ? "pl-4 font-medium"
                          : "text-muted-foreground",
                        column.type === "date-time" && "tabular-nums",
                      );

                      return (
                        <TableCell
                          key={`${rowId}-${column.key}`}
                          className={cellClassName}
                        >
                          <DomainTableCellContent
                            text={text}
                            isPrimary={isPrimary}
                            viewHref={viewHref}
                          />
                        </TableCell>
                      );
                    })}
                    {hasRowActions ? (
                      <TableCell className="pr-2 text-right">
                        <DomainTableRowActions
                          rowId={rowId}
                          row={row}
                          updateFields={updateFields}
                          updateAction={updateAction}
                          deleteAction={deleteAction}
                          showEdit={canEdit}
                          showDelete={Boolean(meta.actions.delete)}
                          editHref={editHref}
                          showView={Boolean(meta.actions.view)}
                          viewHref={viewHref}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTableCard>

      <ListPagination
        basePath={basePath}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        ariaLabel={`${meta.title} list pagination`}
        searchQuery={params.query}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        extraParams={filterExtraParams}
      />
    </>
  );
};
