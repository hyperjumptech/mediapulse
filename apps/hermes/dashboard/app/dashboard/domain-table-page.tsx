import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@workspace/ui/components/button";
import { PageHeader } from "@/components/page-header";
import { SectionSkeleton } from "@/components/page-skeletons";
import { DomainCreateModal } from "@/app/dashboard/domain-create-modal";
import { DomainTableListFilters } from "@/app/dashboard/domain-table-list-filters";
import { DomainTableDangerConfirmButton } from "@/app/dashboard/domain-table-danger-confirm-button";
import { DomainTableJsonUploadCard } from "@/app/dashboard/domain-table-json-upload-card";
import { DomainTableRowsSection } from "@/app/dashboard/domain-table-rows-section";
import { DomainTableSearch } from "@/app/dashboard/domain-table-search";
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
  type DomainTableColumnForDisplay,
} from "@/app/dashboard/domain-table-rows-section";

type DomainTablePageProps = {
  /** Registered domain integration id (URL segment). */
  integrationId: string;
  /** Manifest path segment for this table (e.g. "tickers"). */
  resource: string;
  searchParams: Promise<DomainTableSearchParams> | DomainTableSearchParams;
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
    // Revalidate in place (no redirect) so the client edit modal can close
    // itself once this action resolves; the list is already on `basePath`.
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={meta.title} description={meta.description ?? ""} />

      {showListFilters ? (
        <DomainTableListFilters
          basePath={basePath}
          listFilters={listFilters}
          filterOptions={meta.filterOptions}
          filterValues={params.filters}
          preserveParams={filterFormPreserveParams}
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

      <Suspense key={JSON.stringify(params)} fallback={<SectionSkeleton />}>
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
  );
};
