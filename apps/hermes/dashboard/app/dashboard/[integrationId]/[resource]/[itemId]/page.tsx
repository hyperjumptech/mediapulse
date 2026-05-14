import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@workspace/ui/components/button";

import { DetailBlocksView } from "@/components/detail-blocks";
import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  getDomainTableItemById,
  getDomainTableMeta,
} from "@/lib/domain-dashboard";
import { DATA_SOURCE_EXPANSIONS_PATH_SEGMENT } from "@/lib/data-source-expansion-template-meta";

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
  const title =
    typeof row.title === "string" && row.title.trim().length > 0
      ? row.title
      : typeof row.subject === "string" && row.subject.trim().length > 0
        ? row.subject
        : "Detail";
  const url = typeof row.url === "string" ? row.url : "";
  const content = typeof row.content === "string" ? row.content : "";
  const tickerLabel =
    typeof row.tickerSymbol === "string"
      ? row.tickerSymbol
      : typeof row.tickerName === "string"
        ? row.tickerName
        : "";
  const searchQueryText =
    typeof row.searchQueryText === "string" ? row.searchQueryText : "";
  const createdAt =
    typeof row.createdAt === "string"
      ? row.createdAt
      : String(row.createdAt ?? "");
  const updatedAt =
    typeof row.updatedAt === "string"
      ? row.updatedAt
      : String(row.updatedAt ?? "");

  let metadataBlock: string | null = null;
  if (row.metadata != null) {
    metadataBlock =
      typeof row.metadata === "string"
        ? row.metadata
        : JSON.stringify(row.metadata, null, 2);
  }

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
        {url ? (
          <div className="grid gap-1">
            <dt className="text-muted-foreground">URL</dt>
            <dd>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline underline-offset-4"
              >
                {url}
              </a>
            </dd>
          </div>
        ) : null}
        {tickerLabel ? (
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Ticker</dt>
            <dd>{tickerLabel}</dd>
          </div>
        ) : null}
        {searchQueryText ? (
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Search query</dt>
            <dd>{searchQueryText}</dd>
          </div>
        ) : null}
        <div className="grid gap-1">
          <dt className="text-muted-foreground">Created</dt>
          <dd>{createdAt}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{updatedAt}</dd>
        </div>
      </dl>

      {metadataBlock ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Metadata
          </h2>
          <pre className="max-h-[min(40vh,320px)] overflow-auto rounded-md border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
            {metadataBlock}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Content</h2>
        <pre className="max-h-[min(70vh,720px)] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    </div>
  );
};

export default withAuthProtection(ViewDomainTableItemPage);
