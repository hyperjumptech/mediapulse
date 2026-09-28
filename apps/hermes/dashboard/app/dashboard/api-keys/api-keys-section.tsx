import { KeyRound } from "lucide-react";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { DateTime } from "@/components/date-time/date-time";
import { formatCreatedBy } from "@/lib/format-created-by";
import { listActiveMcpApiKeys } from "@/lib/mcp-api-keys";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { Badge } from "@workspace/ui/components/badge";
import {
  Empty,
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

import { ApiKeyRowActions } from "./api-key-row-actions";

const ApiKeyAccessBadge = ({ readOnly }: { readOnly: boolean }) => {
  if (readOnly) {
    return <Badge variant="muted">Read-only</Badge>;
  }

  return <Badge variant="outline">Full</Badge>;
};

const ApiKeysEmptyState = () => {
  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KeyRound aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No API keys yet</EmptyTitle>
        <EmptyDescription>Create one for MCP access.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export const ApiKeysSection = async () => {
  const keys = await withDashboardAdmin(listActiveMcpApiKeys());

  if (keys.length === 0) {
    return (
      <DataTableCard>
        <ApiKeysEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Label</TableHead>
            <TableHead>Access</TableHead>
            <TableHead className="hidden md:table-cell">Created by</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-12 pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const createdByLabel = formatCreatedBy(
              key.createdBy,
              key.createdByUserId,
            );

            return (
              <TableRow key={key.id}>
                <TableCell className="pl-4 font-medium">{key.label}</TableCell>
                <TableCell>
                  <ApiKeyAccessBadge readOnly={key.readOnly} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {createdByLabel}
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                  <DateTime value={key.createdAt} style="date" />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? (
                    <DateTime value={key.lastUsedAt} variant="both" />
                  ) : (
                    "Never"
                  )}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <ApiKeyRowActions row={{ id: key.id, label: key.label }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
