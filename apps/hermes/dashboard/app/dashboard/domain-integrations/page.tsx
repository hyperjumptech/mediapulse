import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { prisma } from "@hermes/orchestration-database";

/**
 * Lists domain integrations (pending and active) with links to create new.
 */
const DomainIntegrationsPage = async () => {
  const rows = await prisma.domainIntegration.findMany({
    orderBy: [{ isDefault: "desc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      baseUrl: true,
      isActive: true,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Domain integrations"
          description="Create integrations and API keys for Mediapulse, domain-api, and agents. Registration activates a pending integration."
        />
        <Button asChild className="shrink-0">
          <Link href="/dashboard/domain-integrations/create">
            New integration
          </Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Base URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No integrations yet. Create one to get an API key.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.key}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                  {row.baseUrl ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default withAuthProtection(DomainIntegrationsPage);
