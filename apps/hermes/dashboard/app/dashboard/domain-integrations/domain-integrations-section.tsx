import { prisma } from "@hermes/orchestration-database";

import { formatCreatedBy } from "@/lib/format-created-by";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DomainIntegrationRowActions } from "./domain-integration-row-actions";

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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[200px]">Integration id</TableHead>
            <TableHead className="min-w-[140px]">Name</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead>Base URL</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead className="w-[56px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No integrations yet. Create one to get an API key.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm font-medium">
                  {row.integrationId}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={row.status === "active" ? "default" : "secondary"}
                    className="font-normal capitalize"
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground text-sm">
                  {row.baseUrl ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(row.createdBy, row.createdById)}
                </TableCell>
                <TableCell className="text-right">
                  <DomainIntegrationRowActions
                    row={{
                      id: row.id,
                      integrationId: row.integrationId,
                      name: row.name,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
