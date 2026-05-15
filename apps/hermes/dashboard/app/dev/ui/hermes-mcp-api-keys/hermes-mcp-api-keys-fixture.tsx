"use client";

import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
import type { McpApiKeyListRow } from "@/lib/mcp-api-keys";
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

import { CreateApiKeyModal } from "@/app/dashboard/api-keys/create-api-key-modal";

const FIXTURE_KEYS: McpApiKeyListRow[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    label: "Cursor prod read-only",
    readOnly: true,
    createdAt: new Date("2026-05-10T12:00:00Z"),
    lastUsedAt: new Date("2026-05-14T09:30:00Z"),
    createdByUserId: "user-1",
    createdBy: {
      id: "user-1",
      name: "Platform Admin",
      email: "admin@example.com",
    },
  },
];

type HermesMcpApiKeysFixtureProps = {
  /** `empty` shows the empty list state; `list` shows sample rows. */
  variant: "empty" | "list";
};

/**
 * Dev-only fixture for API keys list UI (#496 visual proof).
 */
export const HermesMcpApiKeysFixture = ({
  variant,
}: HermesMcpApiKeysFixtureProps) => {
  const keys = variant === "list" ? FIXTURE_KEYS : [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="API keys"
        description="Create keys for Cursor MCP and other programmatic access. Each key acts as the admin who created it."
      />
      <div className="flex justify-end">
        <CreateApiKeyModal trigger={<Button>Create API key</Button>} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="min-w-[140px]">Label</TableHead>
              <TableHead className="w-[100px]">Access</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[140px]">Last used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                    {key.createdBy?.name ?? "—"} ({key.createdBy?.email})
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(key.createdAt, "LLL d, yyyy")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {key.lastUsedAt
                      ? format(key.lastUsedAt, "LLL d, yyyy HH:mm")
                      : "—"}
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
