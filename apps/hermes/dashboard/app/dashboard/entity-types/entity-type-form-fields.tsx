"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type EntityTypeFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type EntityTypeFormFieldsCreate = EntityTypeFormFieldsBase & {
  mode: "create";
};

type EntityTypeFormFieldsEdit = EntityTypeFormFieldsBase & {
  mode: "edit";
  entityTypeId: string;
  initialName: string;
  initialDescription: string | null;
};

export type EntityTypeFormFieldsProps =
  | EntityTypeFormFieldsCreate
  | EntityTypeFormFieldsEdit;

const descriptionTextareaClassName =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs";

/**
 * Shared name and description fields for create or edit entity type.
 * Renders inputs only; parent wraps in the appropriate FormWithAction.
 */
export const EntityTypeFormFields = (props: EntityTypeFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";

  return (
    <>
      {isEdit ? (
        <input
          type="hidden"
          name="body.entityTypeId"
          value={props.entityTypeId}
          readOnly
        />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          required
          placeholder="e.g. COMPANY"
          disabled={pending}
          {...(isEdit ? { defaultValue: props.initialName } : {})}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.description">Description</Label>
        <textarea
          id="body.description"
          name="body.description"
          rows={isEdit ? 5 : 4}
          disabled={pending}
          className={descriptionTextareaClassName}
          placeholder={
            isEdit ? undefined : "Optional guidance shown to the LLM..."
          }
          {...(isEdit ? { defaultValue: props.initialDescription ?? "" } : {})}
        />
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </>
  );
};
