"use client";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

type VariableFormFieldsBase = {
  /** Whether the form is submitting. */
  pending: boolean;
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
  const { pending, mode } = props;
  const isEdit = mode === "edit";
  const isSecretEdit = isEdit && props.initialIsSecret;
  const valuePlaceholder = isSecretEdit
    ? "Leave blank to keep current value"
    : undefined;
  const valueAutoComplete = isSecretEdit ? "new-password" : "off";

  return (
    <FieldGroup>
      {isEdit && (
        <input type="hidden" name="body.id" value={props.id} readOnly />
      )}
      <Field>
        <FieldLabel htmlFor="body.key">Key</FieldLabel>
        <Input
          id="body.key"
          name="body.key"
          type="text"
          required
          placeholder="e.g. OPENAI_API_KEY"
          className="font-mono"
          disabled={pending}
          {...(isEdit && { defaultValue: props.initialKey })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="body.value">Value</FieldLabel>
        <Input
          id="body.value"
          name="body.value"
          type={isSecretEdit ? "password" : "text"}
          placeholder={valuePlaceholder}
          autoComplete={valueAutoComplete}
          disabled={pending}
          {...(isEdit && !isSecretEdit && { defaultValue: props.initialValue })}
        />
        {isSecretEdit && (
          <FieldDescription>
            Secret values cannot be shown. Enter a new value only to change it.
          </FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor="body.note">Note (optional)</FieldLabel>
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
      </Field>
      <FormBooleanCheckboxField
        name="body.isSecret"
        id="body.isSecret"
        defaultChecked={isEdit ? props.initialIsSecret : false}
        disabled={pending}
        label="Secret"
        description="The value will not be shown after save."
      />
    </FieldGroup>
  );
};
