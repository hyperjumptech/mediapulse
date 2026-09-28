import { format } from "date-fns";

import { formatCreatedBy } from "@/lib/format-created-by";
import { listActiveMcpApiKeys } from "@/lib/mcp-api-keys";
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

import { ApiKeyRowActions } from "./api-key-row-actions";

export const ApiKeysSection = async () => {
  const keys = await withDashboardAdmin(listActiveMcpApiKeys());

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="min-w-[140px]">Label</TableHead>
            <TableHead className="w-[100px]">Access</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead className="w-[140px]">Created</TableHead>
            <TableHead className="w-[140px]">Last used</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No API keys yet. Create one for MCP access.
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.label}</TableCell>
                <TableCell>
                  {key.readOnly ? (
                    <Badge variant="outline" className="font-normal">
                      Read-only
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Full
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatCreatedBy(key.createdBy, key.createdByUserId)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(key.createdAt, "LLL d, yyyy")}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {key.lastUsedAt
                    ? format(key.lastUsedAt, "LLL d, yyyy HH:mm")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <ApiKeyRowActions row={{ id: key.id, label: key.label }} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
