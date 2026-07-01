import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { DomainCreateModal } from "@/app/dashboard/domain-create-modal";
import { DomainTableListFilters } from "@/app/dashboard/domain-table-list-filters";
import { DomainTableRowActions } from "@/app/dashboard/domain-table-row-actions";
import { DomainTableDangerConfirmButton } from "@/app/dashboard/domain-table-danger-confirm-button";
import { DomainTableJsonUploadCard } from "@/app/dashboard/domain-table-json-upload-card";
import { DomainTableSearch } from "@/app/dashboard/domain-table-search";
import { DomainTableSortableHeader } from "@/app/dashboard/domain-table-sortable-header";
import {
  createDomainTableItem,
  deleteDomainTableItem,
  getDomainTableList,
  getDomainTableMeta,
  invokeDomainTableCustomAction,
  invokeDomainTableDangerConfirmAction,
  updateDomainTableItem,
  type DomainTableDangerConfirmState,
  type DomainTableJsonImportState,
} from "@/lib/domain-dashboard";
import {
  formDataToDomainPayload,
  parseDomainTableFormFieldsFromJsonSchema,
} from "@/lib/domain-table-form-schema";
import {
  buildDomainTableFilterExtraParams,
  buildDomainTableListParams,
  buildDomainTablePreserveParams,
  type DomainTableSearchParams,
} from "@/lib/domain-table-list-params";

type DomainTablePageProps = {
  /** Registered domain integration id (URL segment). */
  integrationId: string;
  /** Manifest path segment for this table (e.g. "tickers"). */
  resource: string;
  searchParams: Promise<DomainTableSearchParams> | DomainTableSearchParams;
};

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

/**
 * Shared server-rendered table-v1 page for domain-registered resources.
 *
 * @param props - Integration id, resource path segment, and request search params.
 * @returns Rendered page content.
 */
export const DomainTablePage = async ({
  integrationId,
  resource,
  searchParams,
}: DomainTablePageProps) => {
  const resolved = await Promise.resolve(searchParams);
  const basePath = `/dashboard/${integrationId}/${resource}`;
  const meta = await getDomainTableMeta(integrationId, resource);
  const params = buildDomainTableListParams(resolved, meta);
  const list = await getDomainTableList(integrationId, resource, params);
  const preserveParams = buildDomainTablePreserveParams(params);
  const filterExtraParams = buildDomainTableFilterExtraParams(params.filters);
  const listFilters = meta.listFilters ?? [];
  const showListFilters = listFilters.length > 0;
  const createFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.createSchema,
  );
  const updateFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.updateSchema,
  );

  const createAction = async (formData: FormData) => {
    "use server";
    await createDomainTableItem(
      integrationId,
      resource,
      formDataToDomainPayload(formData, createFields),
    );
    revalidatePath(basePath);
    redirect(basePath);
  };

  const updateAction = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await updateDomainTableItem(
      integrationId,
      resource,
      id,
      formDataToDomainPayload(formData, updateFields),
    );
    revalidatePath(basePath);
    redirect(basePath);
  };

  const deleteAction = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await deleteDomainTableItem(integrationId, resource, id);
    revalidatePath(basePath);
    redirect(basePath);
  };

  const jsonImportServerAction = async (
    _prevState: DomainTableJsonImportState,
    formData: FormData,
  ): Promise<DomainTableJsonImportState> => {
    "use server";
    const actionId = String(formData.get("__actionId") ?? "");
    const payloadJson = String(formData.get("payloadJson") ?? "");
    if (!actionId) {
      return { status: "error", message: "Missing action identifier." };
    }
    if (!payloadJson.trim()) {
      return { status: "error", message: "Select a JSON file first." };
    }
    const result = await invokeDomainTableCustomAction(
      integrationId,
      resource,
      actionId,
      payloadJson,
    );
    if (!result.success) {
      return { status: "error", message: result.message };
    }
    const data = result.data as Record<string, unknown>;
    const added = typeof data.added === "number" ? data.added : 0;
    const updated = typeof data.updated === "number" ? data.updated : 0;
    revalidatePath(basePath);
    return { status: "success", added, updated };
  };

  const jsonImportActions = meta.customActions.filter(
    (entry) => entry.ui === "json-file-upload",
  );

  const dangerConfirmServerAction = async (
    _prevState: DomainTableDangerConfirmState,
    formData: FormData,
  ): Promise<DomainTableDangerConfirmState> => {
    "use server";
    const actionId = String(formData.get("__actionId") ?? "");
    if (!actionId) {
      return { status: "error", message: "Missing action identifier." };
    }
    const result = await invokeDomainTableDangerConfirmAction(
      integrationId,
      resource,
      actionId,
    );
    if (!result.success) {
      return { status: "error", message: result.message };
    }
    const data = result.data as Record<string, unknown>;
    const deleted = typeof data.deleted === "number" ? data.deleted : 0;
    revalidatePath(basePath);
    return { status: "success", deleted };
  };

  const dangerConfirmActions = meta.customActions.filter(
    (entry) => entry.ui === "danger-confirm",
  );

  const hasRowActions =
    meta.actions.update || meta.actions.delete || meta.actions.view;
  const columnCount = meta.columns.length + (hasRowActions ? 1 : 0);
  const fullPage = meta.createNavigation === "full-page";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={meta.title} description={meta.description ?? ""} />

      {showListFilters ? (
        <DomainTableListFilters
          basePath={basePath}
          listFilters={listFilters}
          filterOptions={meta.filterOptions}
          filterValues={params.filters}
          preserveParams={preserveParams}
        />
      ) : null}

      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <DomainTableSearch
            basePath={basePath}
            initialQuery={params.query ?? ""}
            pageSize={params.pageSize}
            sortBy={params.sortBy}
            sortDir={params.sortDir}
            preserveParams={filterExtraParams}
            ariaLabel={`Search ${meta.title}`}
          />
          {dangerConfirmActions.map((action) => (
            <DomainTableDangerConfirmButton
              key={action.id}
              action={action}
              serverAction={dangerConfirmServerAction}
            />
          ))}
          {fullPage && meta.actions.create && createFields.length > 0 ? (
            <Button asChild>
              <Link href={`${basePath}/new`}>{`Add ${meta.title}`}</Link>
            </Button>
          ) : meta.actions.create && createFields.length > 0 ? (
            <DomainCreateModal
              fields={createFields}
              createAction={createAction}
              triggerLabel={`Add ${meta.title}`}
            />
          ) : null}
        </div>
      </div>

      {jsonImportActions.length > 0 ? (
        <div className="flex flex-col gap-4">
          {jsonImportActions.map((action) => (
            <DomainTableJsonUploadCard
              key={action.id}
              action={action}
              serverAction={jsonImportServerAction}
            />
          ))}
        </div>
      ) : null}

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
                      <TableCell key={`${rowId}-${column.key}`}>
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
    </div>
  );
};
