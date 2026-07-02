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

import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

import { useDomainTableRowEditDialog } from "./use-domain-table-row-edit-dialog";

const DELETE_MENU_ITEM_FORM_CLASS =
  "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive";

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
 * Submit control for the delete form; reads pending state from the surrounding form.
 *
 * @returns Delete menu button.
 */
const DomainTableRowDeleteSubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="flex w-full items-center gap-2"
      disabled={pending}
    >
      <Trash2 className="size-4" />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
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
 * @returns Trigger button, optional edit dialog, and delete form.
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
  const deleteLabel = getDomainTableRowDeleteLabel(row, rowId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Row actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {showView && viewHref ? (
            <DropdownMenuItem asChild>
              <Link
                href={viewHref}
                className="flex cursor-pointer items-center"
              >
                <Eye className="mr-2 size-4" />
                View
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showView &&
          viewHref &&
          ((showEdit && updateFields.length > 0) || showDelete) ? (
            <DropdownMenuSeparator />
          ) : null}
          {showEdit && updateFields.length > 0 ? (
            editHref ? (
              <DropdownMenuItem asChild>
                <Link
                  href={editHref}
                  className="flex cursor-pointer items-center"
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
            )
          ) : null}
          {showEdit && updateFields.length > 0 && showDelete ? (
            <DropdownMenuSeparator />
          ) : null}
          {showDelete ? (
            <DropdownMenuItem variant="destructive" asChild>
              <form
                action={deleteAction}
                className={DELETE_MENU_ITEM_FORM_CLASS}
                onSubmit={(e) => {
                  if (
                    !confirm(`Delete "${deleteLabel}"? This cannot be undone.`)
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="__id" value={rowId} readOnly />
                <DomainTableRowDeleteSubmitButton />
              </form>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {showEdit && updateFields.length > 0 && !editHref ? (
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
