import { revalidatePath } from "next/cache";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@workspace/ui/components/button";
import { DataTableSearch } from "@/components/data-table/data-table-search";
import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { DomainCreateModal } from "@/app/dashboard/domain-create-modal";
import { DomainTableListFilters } from "@/app/dashboard/domain-table-list-filters";
import { DomainTableDangerConfirmButton } from "@/app/dashboard/domain-table-danger-confirm-button";
import { DomainTableJsonUploadCard } from "@/app/dashboard/domain-table-json-upload-card";
import { DomainTableRowsSection } from "@/app/dashboard/domain-table-rows-section";
import {
  createDomainTableItem,
  deleteDomainTableItem,
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
  buildDomainTableFilterFormPreserveParams,
  buildDomainTableListParams,
  type DomainTableSearchParams,
} from "@/lib/domain-table-list-params";
import {
  requireDashboardAdmin,
  withDashboardAdmin,
} from "@/lib/require-dashboard-admin";

export {
  formatDomainTableCellValue,
  type DomainTableCellFormatOptions,
  type DomainTableColumnForDisplay,
} from "@/app/dashboard/domain-table-rows-section";

type DomainTablePageProps = {
  integrationId: string;
  resource: string;
  searchParams: Promise<DomainTableSearchParams> | DomainTableSearchParams;
};

export const DomainTablePage = async ({
  integrationId,
  resource,
  searchParams,
}: DomainTablePageProps) => {
  const resolved = await Promise.resolve(searchParams);
  const basePath = `/dashboard/${integrationId}/${resource}`;
  const meta = await withDashboardAdmin(
    getDomainTableMeta(integrationId, resource),
  );
  const params = buildDomainTableListParams(resolved, meta);
  const filterFormPreserveParams =
    buildDomainTableFilterFormPreserveParams(params);
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
    await requireDashboardAdmin();
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
    await requireDashboardAdmin();
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await updateDomainTableItem(
      integrationId,
      resource,
      id,
      formDataToDomainPayload(formData, updateFields),
    );
    revalidatePath(basePath);
  };

  const deleteAction = async (formData: FormData) => {
    "use server";
    await requireDashboardAdmin();
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
    await requireDashboardAdmin();
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
    await requireDashboardAdmin();
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

  const fullPage = meta.createNavigation === "full-page";
  const canCreate = Boolean(meta.actions.create) && createFields.length > 0;
  const createLabel = `Add ${meta.title}`;
  const hasHeaderActions = dangerConfirmActions.length > 0 || canCreate;

  const headerActions = hasHeaderActions ? (
    <>
      {dangerConfirmActions.map((action) => (
        <DomainTableDangerConfirmButton
          key={action.id}
          action={action}
          serverAction={dangerConfirmServerAction}
        />
      ))}
      {canCreate && fullPage ? (
        <Button size="sm" asChild>
          <Link href={`${basePath}/new`}>
            <Plus aria-hidden />
            {createLabel}
          </Link>
        </Button>
      ) : null}
      {canCreate && !fullPage ? (
        <DomainCreateModal
          fields={createFields}
          createAction={createAction}
          triggerLabel={createLabel}
        />
      ) : null}
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader actions={headerActions} />

      {jsonImportActions.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {jsonImportActions.map((action) => (
            <DomainTableJsonUploadCard
              key={action.id}
              action={action}
              serverAction={jsonImportServerAction}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch
            tableId={`${integrationId}-${resource}`}
            urlState={{
              basePath,
              page: params.page,
              pageSize: params.pageSize,
              total: 0,
              search: params.query,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              extra: filterExtraParams,
            }}
            label={`Search ${meta.title}`}
            placeholder={`Filter ${meta.title.toLowerCase()}…`}
          />
          {showListFilters ? (
            <DomainTableListFilters
              basePath={basePath}
              listFilters={listFilters}
              filterOptions={meta.filterOptions}
              filterValues={params.filters}
              preserveParams={filterFormPreserveParams}
            />
          ) : null}
        </div>

        <Suspense fallback={<SectionSkeleton />}>
          <DomainTableRowsSection
            integrationId={integrationId}
            resource={resource}
            basePath={basePath}
            meta={meta}
            params={params}
            updateFields={updateFields}
            updateAction={updateAction}
            deleteAction={deleteAction}
          />
        </Suspense>
      </div>
    </div>
  );
};
