import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { DomainCreateModal } from "@/app/dashboard/domain-create-modal";
import { DomainTableRowActions } from "@/app/dashboard/domain-table-row-actions";
import { DomainTableJsonUploadCard } from "@/app/dashboard/domain-table-json-upload-card";
import { DomainTableSearch } from "@/app/dashboard/domain-table-search";
import {
  createDomainTableItem,
  deleteDomainTableItem,
  getDomainTableList,
  getDomainTableMeta,
  invokeDomainTableCustomAction,
  updateDomainTableItem,
  type DomainTableJsonImportState,
} from "@/lib/domain-dashboard";
import {
  formDataToDomainPayload,
  parseDomainTableFormFieldsFromJsonSchema,
} from "@/lib/domain-table-form-schema";

type DomainTablePageProps = {
  /** Registered domain integration key (e.g. "mediapulse"). */
  integrationKey: string;
  /** Manifest path segment for this table (e.g. "tickers"). */
  resource: string;
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      }>
    | {
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      };
};

/**
 * Parses stringly-typed search params into pagination/sort values.
 *
 * @param searchParams - Route search params object.
 * @returns Parsed values used by list calls.
 */
const parseListParams = (searchParams: {
  page?: string;
  size?: string;
  q?: string;
  sort?: string;
  dir?: string;
}) => {
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.size ?? "15", 10) || 15),
  );
  const query = searchParams.q?.trim() || undefined;
  const sortBy = searchParams.sort?.trim() || undefined;
  const sortDir = searchParams.dir === "desc" ? "desc" : "asc";
  return { page, pageSize, query, sortBy, sortDir } as const;
};

/**
 * Shared server-rendered table-v1 page for domain-registered resources.
 *
 * @param props - Integration key, resource path segment, and request search params.
 * @returns Rendered page content.
 */
export const DomainTablePage = async ({
  integrationKey,
  resource,
  searchParams,
}: DomainTablePageProps) => {
  const resolved = await Promise.resolve(searchParams);
  const params = parseListParams(resolved);
  const basePath = `/dashboard/${integrationKey}/${resource}`;
  const [meta, list] = await Promise.all([
    getDomainTableMeta(integrationKey, resource),
    getDomainTableList(integrationKey, resource, params),
  ]);
  const createFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.createSchema,
  );
  const updateFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.updateSchema,
  );

  const createAction = async (formData: FormData) => {
    "use server";
    await createDomainTableItem(
      integrationKey,
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
      integrationKey,
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
    await deleteDomainTableItem(integrationKey, resource, id);
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
      integrationKey,
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

  const hasRowActions = meta.actions.update || meta.actions.delete;
  const columnCount = meta.columns.length + (hasRowActions ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={meta.title} description={meta.description ?? ""} />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <DomainTableSearch
          basePath={basePath}
          initialQuery={params.query ?? ""}
          pageSize={params.pageSize}
          sortBy={params.sortBy}
          sortDir={params.sortDir}
          ariaLabel={`Search ${meta.title}`}
        />
        <div className="shrink-0 sm:ml-auto">
          {meta.actions.create && createFields.length > 0 ? (
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
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              {meta.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              {hasRowActions ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
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
                return (
                  <TableRow key={rowId}>
                    {meta.columns.map((column) => (
                      <TableCell key={`${rowId}-${column.key}`}>
                        {String(row[column.key] ?? "")}
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
      />
    </div>
  );
};
