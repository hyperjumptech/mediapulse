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
import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useCreateApiKeyModalDevPreviewDialog } from "./use-create-api-key-modal-dev-preview-dialog";

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
  /** `empty` | `list` | `create-modal` (dialog open, create form). */
  variant: "empty" | "list" | "create-modal";
};

/** Dev-only static create modal (no server action) for screenshots. */
const CreateApiKeyModalDevPreview = () => {
  const { open, setOpen } = useCreateApiKeyModalDevPreviewDialog();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="mcp-key-label">Label</Label>
            <Input
              id="mcp-key-label"
              name="body.label"
              placeholder="e.g. Cursor prod read-only"
              autoComplete="off"
            />
          </div>
          <FormBooleanCheckboxField
            id="mcp-key-read-only"
            name="body.readOnly"
            defaultChecked={false}
            checkedSubmitValue="true"
            label="Read-only (no dashboard mutations via MCP)"
            labelClassName="font-normal"
          />
          <Button type="submit">Create key</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
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
        {variant === "create-modal" ? (
          <>
            <Button type="button">Create API key</Button>
            <CreateApiKeyModalDevPreview />
          </>
        ) : (
          <CreateApiKeyModal trigger={<Button>Create API key</Button>} />
        )}
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
