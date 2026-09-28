import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { DetailBlocksView } from "@/components/detail-blocks";
import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { PageHeader } from "@/components/page-header";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import {
  formatDomainTableCellValue,
  type DomainTableCellFormatOptions,
  type DomainTableColumnForDisplay,
} from "@/app/dashboard/domain-table-page";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  getDomainTableItemById,
  getDomainTableMeta,
} from "@/lib/domain-dashboard";
import { DATA_SOURCE_EXPANSIONS_PATH_SEGMENT } from "@/lib/data-source-expansion-template-meta";
import { getViewerDateTimeContext } from "@/lib/date-time/viewer-date-time";
import { parseDomainTableFormFieldsFromJsonSchema } from "@/lib/domain-table-form-schema";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

type DomainTableMeta = Awaited<ReturnType<typeof getDomainTableMeta>>;

type DetailField = {
  key: string;
  label: string;
  display: string;
  isLong: boolean;
};

const LONG_VALUE_CHARACTER_COUNT = 120;

const resolveDomainTableDetailTitle = (
  columns: DomainTableColumnForDisplay[] | undefined,
  row: Record<string, unknown>,
  formatOptions: DomainTableCellFormatOptions,
  detailTitleField?: string,
): string => {
  if (detailTitleField) {
    const raw = row[detailTitleField];
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
  }
  const primary = columns?.[0];
  if (!primary) return "Detail";
  const value = formatDomainTableCellValue(
    primary,
    row[primary.key],
    formatOptions,
  );

  return value.trim().length > 0 ? value : "Detail";
};

const resolveEditHref = (
  meta: DomainTableMeta,
  basePath: string,
  itemId: string,
): string | null => {
  const isFullPageEditor = meta.createNavigation === "full-page";
  const updateFields = parseDomainTableFormFieldsFromJsonSchema(
    meta.updateSchema,
  );
  const canEdit = Boolean(meta.actions.update) && updateFields.length > 0;
  if (!isFullPageEditor || !canEdit) {
    return null;
  }

  return `${basePath}/${encodeURIComponent(itemId)}/edit`;
};

const collectDetailFields = (
  columns: DomainTableColumnForDisplay[],
  row: Record<string, unknown>,
  formatOptions: DomainTableCellFormatOptions,
): DetailField[] =>
  columns.flatMap((column) => {
    const rawValue = row[column.key];
    if (rawValue == null || rawValue === "") {
      return [];
    }
    const display = formatDomainTableCellValue(column, rawValue, formatOptions);
    if (display.length === 0) {
      return [];
    }
    const isLong =
      display.length > LONG_VALUE_CHARACTER_COUNT || display.includes("\n");

    return [{ key: column.key, label: column.label, display, isLong }];
  });

const EditItemAction = ({ editHref }: { editHref: string }) => {
  return (
    <Button variant="outline" asChild>
      <Link href={editHref}>
        <Pencil aria-hidden />
        Edit
      </Link>
    </Button>
  );
};

const ViewDomainTableItemPage = async ({
  params,
}: {
  params: Promise<{
    integrationId: string;
    resource: string;
    itemId: string;
  }>;
}) => {
  const { integrationId, resource, itemId } = await params;
  const integration = await withDashboardAdmin(
    getDomainIntegrationByIntegrationId(integrationId),
  );
  if (!integration) notFound();

  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    notFound();
  }

  const meta = await getDomainTableMeta(integrationId, resource);
  if (!meta.actions.view) notFound();

  const row = await getDomainTableItemById(integrationId, resource, itemId);
  if (!row) notFound();

  const { timeZone, renderedAt } = await getViewerDateTimeContext();
  const formatOptions: DomainTableCellFormatOptions = {
    timeZone,
    now: new Date(renderedAt),
    style: "datetime",
  };
  const basePath = `/dashboard/${integrationId}/${resource}`;
  const detailBlocks = meta.detailBlocks;
  const blockData = { ...row, integrationId, resource, itemId };
  const title = resolveDomainTableDetailTitle(
    meta.columns,
    row,
    formatOptions,
    meta.detailTitleField,
  );
  const editHref = resolveEditHref(meta, basePath, itemId);
  const editAction = editHref ? (
    <EditItemAction editHref={editHref} />
  ) : undefined;
  const header = (
    <>
      <BreadcrumbEntityLabel segment={itemId} label={title} />
      <PageHeader actions={editAction} />
    </>
  );

  if (detailBlocks && detailBlocks.length > 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <DetailBlocksView blocks={detailBlocks} data={blockData} />
      </div>
    );
  }

  const detailFields = collectDetailFields(
    meta.columns ?? [],
    row,
    formatOptions,
  );

  return (
    <div className="flex flex-col gap-6">
      {header}
      {detailFields.length > 0 ? (
        <SummaryGrid>
          {detailFields.map((field) => (
            <SummaryItem
              key={field.key}
              label={field.label}
              className={field.isLong ? "col-span-full" : undefined}
            >
              <span className="whitespace-pre-wrap">{field.display}</span>
            </SummaryItem>
          ))}
        </SummaryGrid>
      ) : (
        <p className="text-sm text-muted-foreground">
          This item has no values to show.
        </p>
      )}
    </div>
  );
};

export default ViewDomainTableItemPage;
