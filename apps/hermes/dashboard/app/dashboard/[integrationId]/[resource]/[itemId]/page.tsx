import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@workspace/ui/components/button";

import { DetailBlocksView } from "@/components/detail-blocks";
import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  formatDomainTableCellValue,
  type DomainTableColumnForDisplay,
} from "@/app/dashboard/domain-table-page";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  getDomainTableItemById,
  getDomainTableMeta,
} from "@/lib/domain-dashboard";
import { DATA_SOURCE_EXPANSIONS_PATH_SEGMENT } from "@/lib/data-source-expansion-template-meta";

/**
 * Resolves a detail page title from the first manifest column when present.
 *
 * @param columns - Table columns from domain meta.
 * @param row - Detail row payload from the domain API.
 * @returns Display title for the page header.
 */
const resolveDomainTableDetailTitle = (
  columns: DomainTableColumnForDisplay[] | undefined,
  row: Record<string, unknown>,
): string => {
  const primary = columns?.[0];
  if (!primary) return "Detail";
  const value = formatDomainTableCellValue(primary, row[primary.key]);
  return value.trim().length > 0 ? value : "Detail";
};

/**
 * Read-only detail page for table-v1 resources that set `actions.view` in the manifest.
 */
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
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) notFound();

  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    notFound();
  }

  const meta = await getDomainTableMeta(integrationId, resource);
  if (!meta.actions.view) notFound();

  const row = await getDomainTableItemById(integrationId, resource, itemId);
  if (!row) notFound();

  const basePath = `/dashboard/${integrationId}/${resource}`;
  const detailBlocks = meta.detailBlocks;
  const blockData = { ...row, integrationId, resource, itemId };
  const title = resolveDomainTableDetailTitle(meta.columns, row);

  if (detailBlocks && detailBlocks.length > 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader title={title} description={meta.description ?? ""} />
          <Button variant="outline" asChild className="shrink-0">
            <Link href={basePath}>Back to list</Link>
          </Button>
        </div>
        <DetailBlocksView blocks={detailBlocks} data={blockData} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={title} description={meta.description ?? ""} />
        <Button variant="outline" asChild className="shrink-0">
          <Link href={basePath}>Back to list</Link>
        </Button>
      </div>

      <dl className="grid max-w-3xl gap-2 text-sm">
        {(meta.columns ?? []).map((column) => {
          const rawValue = row[column.key];
          if (rawValue == null || rawValue === "") {
            return null;
          }
          const display = formatDomainTableCellValue(column, rawValue);
          if (display.length === 0) {
            return null;
          }
          return (
            <div key={column.key} className="grid gap-1">
              <dt className="text-muted-foreground">{column.label}</dt>
              <dd className="break-words whitespace-pre-wrap">{display}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
};

export default withAuthProtection(ViewDomainTableItemPage);
