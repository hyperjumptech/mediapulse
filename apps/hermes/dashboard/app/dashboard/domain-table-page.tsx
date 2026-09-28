import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListBodySkeleton } from "@/components/page-skeletons";
import { DomainCreateModal } from "@/app/dashboard/domain-create-modal";
import { DomainTableDangerConfirmButton } from "@/app/dashboard/domain-table-danger-confirm-button";
import { DomainTableJsonImportDialog } from "@/app/dashboard/domain-table-json-import-dialog";
import { DomainTableListFilters } from "@/app/dashboard/domain-table-list-filters";
import { DomainTableSection } from "@/app/dashboard/domain-table-section";
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
  buildDomainTableFilterFormPreserveParams,
  buildDomainTableListParams,
  type DomainTableSearchParams,
} from "@/lib/domain-table-list-params";
import {
  requireDashboardAdmin,
  withDashboardAdmin,
} from "@/lib/require-dashboard-admin";

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
  const listFilters = meta.listFilters ?? [];
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

  const jsonImportActions = meta.customActions.filter(
    (entry) => entry.ui === "json-file-upload",
  );
  const dangerConfirmActions = meta.customActions.filter(
    (entry) => entry.ui === "danger-confirm",
  );
  const hasToolbarActions =
    jsonImportActions.length > 0 || dangerConfirmActions.length > 0;
  const canCreateInModal =
    Boolean(meta.actions.create) &&
    createFields.length > 0 &&
    meta.createNavigation !== "full-page";

  const toolbarActions = hasToolbarActions
    ? [
        ...jsonImportActions.map((action) => (
          <DomainTableJsonImportDialog
            key={`import-${action.id}`}
            action={action}
            serverAction={jsonImportServerAction}
          />
        )),
        ...dangerConfirmActions.map((action) => (
          <DomainTableDangerConfirmButton
            key={`danger-${action.id}`}
            action={action}
            serverAction={dangerConfirmServerAction}
          />
        )),
      ]
    : undefined;

  const toolbarFilters =
    listFilters.length > 0 ? (
      <DomainTableListFilters
        key="list-filters"
        basePath={basePath}
        listFilters={listFilters}
        filterOptions={meta.filterOptions}
        filterValues={params.filters}
        preserveParams={buildDomainTableFilterFormPreserveParams(params)}
      />
    ) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ListBodySkeleton />}>
        <DomainTableSection
          integrationId={integrationId}
          resource={resource}
          basePath={basePath}
          meta={meta}
          params={params}
          updateFields={updateFields}
          updateAction={updateAction}
          deleteAction={deleteAction}
          toolbarFilters={toolbarFilters}
          toolbarActions={toolbarActions}
        />
      </Suspense>
      {canCreateInModal ? (
        <DomainCreateModal
          fields={createFields}
          createAction={createAction}
          title={`Add ${meta.title}`}
        />
      ) : null}
    </div>
  );
};
