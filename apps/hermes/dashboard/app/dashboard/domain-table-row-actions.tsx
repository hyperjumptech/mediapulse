"use client";

import { useState } from "react";
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
import { Input } from "@workspace/ui/components/input";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const DELETE_MENU_ITEM_FORM_CLASS =
  "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive";

type DomainTableRowField = {
  key: string;
  label: string;
  required: boolean;
};

export type DomainTableRowActionsProps = {
  rowId: string;
  row: Record<string, unknown>;
  updateFields: DomainTableRowField[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  showEdit: boolean;
  showDelete: boolean;
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
 * Manages visibility of the edit dialog for a domain table row.
 *
 * @returns `editOpen` flag and `setEditOpen` setter for the dialog.
 */
export const useDomainTableRowEditDialog = () => {
  const [editOpen, setEditOpen] = useState(false);
  return { editOpen, setEditOpen };
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
          {showEdit && updateFields.length > 0 ? (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
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

      {showEdit && updateFields.length > 0 ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Edit</DialogTitle>
            </DialogHeader>
            <form action={updateAction} className="grid gap-3">
              <input type="hidden" name="__id" value={rowId} readOnly />
              {updateFields.map((field) => (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span>{field.label}</span>
                  <Input
                    name={field.key}
                    defaultValue={String(row[field.key] ?? "")}
                    required={field.required}
                  />
                </label>
              ))}
              <div>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
