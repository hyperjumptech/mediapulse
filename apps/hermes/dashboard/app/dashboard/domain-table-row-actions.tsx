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
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
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
  editHref?: string;
  showView?: boolean;
  viewHref?: string;
};

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

const DomainTableRowEditSubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
};

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
      <RowActionsMenu label={`Actions for ${deleteLabel}`}>
        {canView && viewHref ? (
          <DropdownMenuItem asChild>
            <Link href={viewHref}>View</Link>
          </DropdownMenuItem>
        ) : null}
        {canView && (canEdit || showDelete) ? <DropdownMenuSeparator /> : null}
        {canEdit && editHref ? (
          <DropdownMenuItem asChild>
            <Link href={editHref}>Edit</Link>
          </DropdownMenuItem>
        ) : null}
        {canEdit && !editHref ? (
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
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
            Delete
          </DropdownMenuItem>
        ) : null}
      </RowActionsMenu>

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
