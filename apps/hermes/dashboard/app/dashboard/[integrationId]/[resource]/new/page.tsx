import { notFound } from "next/navigation";

import { DomainTableFullPageEditor } from "@/components/domain-table-full-page-editor";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import { getDomainTableMeta } from "@/lib/domain-dashboard";
import { submitDomainTableFullPageCreate } from "@/lib/domain-table-full-page-actions";
import {
  formDataToDomainPayload,
  parseDomainTableFormFieldsFromJsonSchema,
} from "@/lib/domain-table-form-schema";
import {
  requireDashboardAdmin,
  withDashboardAdmin,
} from "@/lib/require-dashboard-admin";

/**
 * Full-page create flow for table-v1 resources that set `createNavigation: "full-page"` in the manifest.
 */
const NewDomainTablePage = async ({
  params,
}: {
  params: Promise<{ integrationId: string; resource: string }>;
}) => {
  const { integrationId, resource } = await params;
  const integration = await withDashboardAdmin(
    getDomainIntegrationByIntegrationId(integrationId),
  );
  if (!integration) notFound();

  const meta = await getDomainTableMeta(integrationId, resource);
  if (meta.createNavigation !== "full-page") notFound();
  if (!meta.actions.create) notFound();

  const createFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.createSchema,
  );
  if (createFields.length === 0) notFound();

  const basePath = `/dashboard/${integrationId}/${resource}`;

  const createAction = async (formData: FormData) => {
    "use server";
    await requireDashboardAdmin();
    await submitDomainTableFullPageCreate(
      integrationId,
      resource,
      basePath,
      formDataToDomainPayload(formData, createFields),
    );
  };

  const showPreview =
    Boolean(meta.preview?.enabled) &&
    integration.capabilities.includes("preview-expansion");

  return (
    <DomainTableFullPageEditor
      title={`Add ${meta.title}`}
      description={meta.description ?? ""}
      basePath={basePath}
      fields={createFields}
      mode="create"
      formAction={createAction}
      integrationId={integrationId}
      showPreview={showPreview}
      previewFieldKey={meta.preview?.fieldKey}
    />
  );
};

export default NewDomainTablePage;
