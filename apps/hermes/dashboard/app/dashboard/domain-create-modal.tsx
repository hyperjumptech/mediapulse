"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";

type DomainCreateField = {
  key: string;
  label: string;
  required: boolean;
};

type DomainCreateModalProps = {
  fields: DomainCreateField[];
  createAction: (formData: FormData) => Promise<void>;
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
}: DomainCreateModalProps) => {
  if (fields.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">Create new</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create new</DialogTitle>
        </DialogHeader>
        <form action={createAction} className="grid gap-3">
          {fields.map((field) => (
            <label key={field.key} className="grid gap-1 text-sm">
              <span>{field.label}</span>
              <Input name={field.key} required={field.required} />
            </label>
          ))}
          <div>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
