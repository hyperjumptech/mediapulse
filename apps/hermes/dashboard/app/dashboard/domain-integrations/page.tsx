import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { Badge } from "@workspace/ui/components/badge";
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
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Domain integrations"
        description="Create integrations and API keys for Mediapulse, domain-api, and agents. Registration activates a pending integration."
      />
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/domain-integrations/create">
            New integration
          </Link>
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="w-[200px]">Key</TableHead>
              <TableHead className="min-w-[140px]">Name</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Base URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No integrations yet. Create one to get an API key.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {row.key}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "active" ? "default" : "secondary"
                      }
                      className="font-normal capitalize"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground text-sm">
                    {row.baseUrl ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default withAuthProtection(DomainIntegrationsPage);
