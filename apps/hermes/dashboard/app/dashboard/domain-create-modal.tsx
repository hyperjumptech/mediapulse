"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { DomainTableFormFields } from "@/components/domain-table-form-fields";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

type DomainCreateModalProps = {
  fields: DomainTableFormField[];
  createAction: (formData: FormData) => Promise<void>;
  /** Label for the button that opens the dialog (e.g. "Add variable"). */
  triggerLabel?: string;
};

/**
 * Renders a "Create new" button that opens a modal with dynamic form fields.
 *
 * @param props - Create form schema fields and server action handler.
 * @returns Trigger button with a dialog-backed create form.
 */
export const DomainCreateModal = ({
  fields,
  createAction,
  triggerLabel = "Create new",
}: DomainCreateModalProps) => {
  if (fields.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent
        className="grid max-h-[min(90vh,880px)] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>Create new</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-y-contain px-6 py-4">
          <form action={createAction} className="grid gap-3">
            <DomainTableFormFields fields={fields} />
            <div>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
