"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type ApiKeyFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type ApiKeyFormFieldsCreate = ApiKeyFormFieldsBase & {
  mode: "create";
};

type ApiKeyFormFieldsEdit = ApiKeyFormFieldsBase & {
  mode: "edit";
  id: string;
  initialName: string;
  initialIsActive: boolean;
};

export type ApiKeyFormFieldsProps =
  | ApiKeyFormFieldsCreate
  | ApiKeyFormFieldsEdit;

/**
 * Shared form fields for create and edit API key: name; edit adds isActive.
 * Renders inputs only; parent must wrap in a form (e.g. FormWithAction).
 */
export const ApiKeyFormFields = (props: ApiKeyFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";

  return (
    <>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          required
          placeholder="e.g. Production key"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialName })}
        />
      </div>
      {isEdit && (
        <div className="flex items-center gap-2">
          <input type="hidden" name="body.isActive" value="false" />
          <input
            type="checkbox"
            id="body.isActive"
            name="body.isActive"
            value="true"
            defaultChecked={props.initialIsActive}
            disabled={pending}
            className="size-4 rounded border-input"
          />
          <Label
            htmlFor="body.isActive"
            className="cursor-pointer text-sm font-normal"
          >
            Active
          </Label>
        </div>
      )}
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
