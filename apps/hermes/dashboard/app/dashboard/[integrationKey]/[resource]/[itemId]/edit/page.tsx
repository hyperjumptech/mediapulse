import { notFound } from "next/navigation";

import { DomainTableFullPageEditor } from "@/components/domain-table-full-page-editor";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByKey } from "@/lib/domain-integrations";
import {
  getDomainTableItemById,
  getDomainTableMeta,
} from "@/lib/domain-dashboard";
import { submitDomainTableFullPageUpdate } from "@/lib/domain-table-full-page-actions";
import {
  formDataToDomainPayload,
  parseDomainTableFormFieldsFromJsonSchema,
} from "@/lib/domain-table-form-schema";

/**
 * Full-page edit flow for table-v1 resources that set `createNavigation: "full-page"` in the manifest.
 */
const EditDomainTablePage = async ({
  params,
}: {
  params: Promise<{
    integrationKey: string;
    resource: string;
    itemId: string;
  }>;
}) => {
  const { integrationKey, resource, itemId } = await params;
  const integration = await getDomainIntegrationByKey(integrationKey);
  if (!integration) notFound();

  const meta = await getDomainTableMeta(integrationKey, resource);
  if (meta.createNavigation !== "full-page") notFound();
  if (!meta.actions.update) notFound();

  const row = await getDomainTableItemById(integrationKey, resource, itemId);
  if (!row) notFound();

  const updateFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.updateSchema,
  );
  if (updateFields.length === 0) notFound();

  const basePath = `/dashboard/${integrationKey}/${resource}`;

  const updateAction = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await submitDomainTableFullPageUpdate(
      integrationKey,
      resource,
      id,
      basePath,
      formDataToDomainPayload(formData, updateFields),
    );
  };

  const showPreview =
    Boolean(meta.preview?.enabled) &&
    integration.capabilities.includes("preview-expansion");

  return (
    <DomainTableFullPageEditor
      title={`Edit ${meta.title}`}
      description={meta.description ?? ""}
      basePath={basePath}
      fields={updateFields}
      mode="edit"
      rowId={itemId}
      defaultRow={row}
      formAction={updateAction}
      integrationKey={integrationKey}
      showPreview={showPreview}
      previewFieldKey={meta.preview?.fieldKey}
    />
  );
};

export default withAuthProtection(EditDomainTablePage);
