"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

import { useDomainTableRowDeleteAction } from "./use-domain-table-row-delete-action";
import { useDomainTableRowEditDialog } from "./use-domain-table-row-edit-dialog";

export type DomainTableRowActionsProps = {
  rowId: string;
  row: Record<string, unknown>;
  updateFields: DomainTableFormField[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  showEdit: boolean;
  showDelete: boolean;
  /** When set, Edit navigates here instead of opening the edit modal. */
  editHref?: string;
  /** When set with `viewHref`, shows a read-only detail link (manifest `actions.view`). */
  showView?: boolean;
  /** Target for the View action (typically `${basePath}/${rowId}`). */
  viewHref?: string;
};

/**
 * Derives a short label for the delete confirmation dialog from row payload.
 *
 * @param row - Table row values.
 * @param rowId - Stable row identifier.
 * @returns Display string for confirm copy.
 */
export const getDomainTableRowDeleteLabel = (
  row: Record<string, unknown>,
  rowId: string,
): string => {
  const candidate = row.name;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return rowId;
};

/**
 * Submit button for the edit modal; reflects the pending state of the
 * surrounding form so the user gets feedback while the update runs.
 *
 * @returns Save button that shows a saving state while pending.
 */
const DomainTableRowEditSubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
};

/**
 * Row actions for generic domain table-v1 resources: ellipsis menu with Edit (modal) and Delete.
 *
 * @param props - Row data, field schema, server actions, and visibility flags.
 * @returns Trigger button, optional edit dialog, and delete confirmation.
 */
export const DomainTableRowActions = ({
  rowId,
  row,
  updateFields,
  updateAction,
  deleteAction,
  showEdit,
  showDelete,
  editHref,
  showView = false,
  viewHref,
}: DomainTableRowActionsProps) => {
  const { editOpen, setEditOpen } = useDomainTableRowEditDialog();
  const deleteConfirmation = useDomainTableRowDeleteAction(deleteAction);
  const deleteLabel = getDomainTableRowDeleteLabel(row, rowId);
  const canView = showView && Boolean(viewHref);
  const canEdit = showEdit && updateFields.length > 0;
  const deleteHiddenFields = [{ name: "__id", value: rowId }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for ${deleteLabel}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canView && viewHref ? (
            <DropdownMenuItem asChild>
              <Link href={viewHref}>
                <Eye />
                View
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canView && (canEdit || showDelete) ? (
            <DropdownMenuSeparator />
          ) : null}
          {canEdit && editHref ? (
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Pencil />
                Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canEdit && !editHref ? (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
          ) : null}
          {canEdit && showDelete ? <DropdownMenuSeparator /> : null}
          {showDelete ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={deleteConfirmation.pending}
              onSelect={deleteConfirmation.requestConfirmation}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDelete ? (
        <ConfirmActionDialog
          open={deleteConfirmation.open}
          onOpenChange={deleteConfirmation.setOpen}
          title={`Delete "${deleteLabel}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          pending={deleteConfirmation.pending}
          FormWithAction={deleteConfirmation.FormWithAction}
          hiddenFields={deleteHiddenFields}
        />
      ) : null}

      {canEdit && !editHref ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent
            className="grid max-h-[min(90vh,880px)] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
            aria-describedby={undefined}
          >
            <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
              <DialogTitle>Edit</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto overscroll-y-contain px-6 py-4">
              <form
                action={async (formData) => {
                  await updateAction(formData);
                  setEditOpen(false);
                }}
                className="grid gap-3"
              >
                <input type="hidden" name="__id" value={rowId} readOnly />
                <DomainTableFormFields fields={updateFields} defaultRow={row} />
                <div>
                  <DomainTableRowEditSubmitButton />
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
