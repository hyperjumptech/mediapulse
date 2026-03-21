"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type RelationTypeFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type RelationTypeFormFieldsCreate = RelationTypeFormFieldsBase & {
  mode: "create";
};

type RelationTypeFormFieldsEdit = RelationTypeFormFieldsBase & {
  mode: "edit";
  relationTypeId: string;
  initialName: string;
  initialDescription: string | null;
};

export type RelationTypeFormFieldsProps =
  | RelationTypeFormFieldsCreate
  | RelationTypeFormFieldsEdit;

const descriptionTextareaClassName =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs";

/**
 * Shared name and description fields for create or edit relation type.
 * Renders inputs only; parent wraps in the appropriate FormWithAction.
 */
export const RelationTypeFormFields = (props: RelationTypeFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";

  return (
    <>
      {isEdit ? (
        <input
          type="hidden"
          name="body.relationTypeId"
          value={props.relationTypeId}
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
          placeholder="e.g. CEO_OF"
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
