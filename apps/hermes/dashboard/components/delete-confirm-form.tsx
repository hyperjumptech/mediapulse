"use client";

import { Trash2 } from "lucide-react";

const DROPDOWN_ITEM_CLASS =
  "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive [&_button]:flex [&_button]:w-full [&_button]:cursor-default [&_button]:items-center [&_button]:text-left";

export type DeleteConfirmFormProps = {
  /** Form component from useFormAction() (e.g. FormWithAction). Receives className, onSubmit, children. */
  FormWithAction: React.ComponentType<{
    className?: string;
    onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
    children: React.ReactNode;
  }>;
  /** Message shown in confirm() dialog; if user cancels, form submit is prevented. */
  confirmMessage: string;
  /** Hidden input name and value for the delete action body (e.g. body.id, body.scheduleId). */
  bodyField: { name: string; value: string };
  /** Whether the delete action is pending (shows "Deleting…" on button). */
  pending: boolean;
  /** Optional class name for the form (defaults to dropdown item styling). */
  className?: string;
};

/**
 * Reusable delete form with confirm dialog. Use inside a dropdown row action.
 * Confirm runs in form onSubmit so cancelling actually prevents submit (not in menu onSelect).
 */
export const DeleteConfirmForm = ({
  FormWithAction,
  confirmMessage,
  bodyField,
  pending,
  className = DROPDOWN_ITEM_CLASS,
}: DeleteConfirmFormProps) => (
  <FormWithAction
    className={className}
    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
      if (!confirm(confirmMessage)) {
        e.preventDefault();
      }
    }}
  >
    <input
      type="hidden"
      name={bodyField.name}
      value={bodyField.value}
      readOnly
    />
    <button type="submit" className="flex items-center gap-2">
      <Trash2 className="size-4" />
      {pending ? "Deleting…" : "Delete"}
    </button>
  </FormWithAction>
);
