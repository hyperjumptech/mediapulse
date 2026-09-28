import { format } from "date-fns";
import type { TableV1MetaResponse } from "@hermes/domain-contract";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table";
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
  const columnCount = meta.columns.length + (hasRowActions ? 1 : 0);
  const fullPage = meta.createNavigation === "full-page";

  return (
    <>
      <div className="rounded-md border">
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
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-center text-muted-foreground"
                >
                  No {meta.title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((item) => {
                const row = item as Record<string, unknown>;
                const rowId = String(row.id ?? "");
                const editHref =
                  fullPage &&
                  Boolean(meta.actions.update) &&
                  updateFields.length > 0
                    ? `${basePath}/${encodeURIComponent(rowId)}/edit`
                    : undefined;
                const viewHref = meta.actions.view
                  ? `${basePath}/${encodeURIComponent(rowId)}`
                  : undefined;

                return (
                  <TableRow key={rowId}>
                    {meta.columns.map((column) => (
                      <TableCell
                        key={`${rowId}-${column.key}`}
                        className="whitespace-nowrap"
                      >
                        {formatDomainTableCellValue(column, row[column.key])}
                      </TableCell>
                    ))}
                    {hasRowActions ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <DomainTableRowActions
                            rowId={rowId}
                            row={row}
                            updateFields={updateFields}
                            updateAction={updateAction}
                            deleteAction={deleteAction}
                            showEdit={
                              Boolean(meta.actions.update) &&
                              updateFields.length > 0
                            }
                            showDelete={Boolean(meta.actions.delete)}
                            editHref={editHref}
                            showView={Boolean(meta.actions.view)}
                            viewHref={viewHref}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
