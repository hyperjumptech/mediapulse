"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

type VariableFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
  /** Error message to show when submit failed. */
  errorMessage: string | null;
  /** Label for the submit button. */
  submitLabel: string;
};

type VariableFormFieldsCreate = VariableFormFieldsBase & {
  mode: "create";
};

type VariableFormFieldsEdit = VariableFormFieldsBase & {
  mode: "edit";
  id: string;
  initialKey: string;
  initialValue: string;
  initialNote: string | null;
  initialIsSecret: boolean;
};

export type VariableFormFieldsProps =
  | VariableFormFieldsCreate
  | VariableFormFieldsEdit;

/**
 * Shared form fields for create and edit variable: key, value, note, isSecret.
 * For edit with isSecret, value shows placeholder and "Leave blank to keep current value".
 * Renders inputs only; parent must wrap in a form (e.g. FormWithAction).
 */
export const VariableFormFields = (props: VariableFormFieldsProps) => {
  const { pending, errorMessage, submitLabel, mode } = props;
  const isEdit = mode === "edit";
  const isSecretEdit = isEdit && props.initialIsSecret;
  const valuePlaceholder = isSecretEdit
    ? "Leave blank to keep current value"
    : undefined;

  return (
    <>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <div className="grid gap-2">
        <Label htmlFor="body.key">Key</Label>
        <Input
          id="body.key"
          name="body.key"
          type="text"
          required
          placeholder="e.g. OPENAI_API_KEY"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialKey })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.value">Value</Label>
        <Input
          id="body.value"
          name="body.value"
          type={isSecretEdit ? "password" : "text"}
          placeholder={valuePlaceholder}
          disabled={pending}
          {...(isEdit && !isSecretEdit && { defaultValue: props.initialValue })}
        />
        {isSecretEdit && (
          <p className="text-muted-foreground text-xs">
            Secret values cannot be shown. Enter a new value only to change it.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.note">Note (optional)</Label>
        <Input
          id="body.note"
          name="body.note"
          type="text"
          placeholder="Brief description"
          disabled={pending}
          {...(isEdit && {
            defaultValue: props.initialNote ?? "",
          })}
        />
      </div>
      <FormBooleanCheckboxField
        name="body.isSecret"
        id="body.isSecret"
        defaultChecked={isEdit ? props.initialIsSecret : false}
        disabled={pending}
        label="Secret (value will not be shown after save)"
        labelClassName="cursor-pointer text-sm font-normal"
      />
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
