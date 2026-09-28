import { prisma } from "@hermes/orchestration-database";
import { Blocks, Plus } from "lucide-react";
import Link from "next/link";

import { CopyableId } from "@/components/copyable-id";
import { DataTableCard } from "@/components/data-table/data-table-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCreatedBy } from "@/lib/format-created-by";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DomainIntegrationRowActions } from "./domain-integration-row-actions";

const DomainIntegrationsEmptyState = () => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Blocks aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No integrations yet</EmptyTitle>
        <EmptyDescription>Create one to get an API key.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/domain-integrations/create">
            <Plus aria-hidden />
            New integration
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};

export const DomainIntegrationsSection = async () => {
  const rows = await withDashboardAdmin(
    prisma.domainIntegration.findMany({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: {
        id: true,
        integrationId: true,
        name: true,
        status: true,
        baseUrl: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  );

  if (rows.length === 0) {
    return (
      <DataTableCard>
        <DomainIntegrationsEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Integration id</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Base URL</TableHead>
            <TableHead className="hidden lg:table-cell">Created by</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const createdByLabel = formatCreatedBy(
              row.createdBy,
              row.createdById,
            );

            return (
              <TableRow key={row.id}>
                <TableCell className="pl-4 font-medium">{row.name}</TableCell>
                <TableCell>
                  <CopyableId
                    value={row.integrationId}
                    label={`Copy integration id ${row.integrationId}`}
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {row.baseUrl ? (
                    <div className="max-w-xs truncate" title={row.baseUrl}>
                      {row.baseUrl}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {createdByLabel}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <DomainIntegrationRowActions
                    row={{
                      id: row.id,
                      integrationId: row.integrationId,
                      name: row.name,
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
