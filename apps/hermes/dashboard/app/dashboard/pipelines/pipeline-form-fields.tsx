"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

export type PipelineFormFieldsProps = {
  /** Name prefix for form fields, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  defaultName: string;
  defaultDescription: string;
  defaultIsActive: boolean;
  /** When set, renders hidden pipelineId for update action */
  pipelineId?: string;
};

/**
 * Shared pipeline form fields: name, description, isActive.
 * Used by both create and edit modals to avoid duplication.
 */
export const PipelineFormFields = ({
  namePrefix = "body",
  pending,
  errorMessage,
  submitLabel,
  defaultName,
  defaultDescription,
  defaultIsActive,
  pipelineId,
}: PipelineFormFieldsProps) => {
  const pre = namePrefix ? `${namePrefix}.` : "";

  return (
    <>
      {pipelineId != null ? (
        <input
          type="hidden"
          name={`${pre}pipelineId`}
          value={pipelineId}
          readOnly
        />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={`${pre}name`}>Name</Label>
        <Input
          id={`${pre}name`}
          name={`${pre}name`}
          type="text"
          required
          placeholder="My pipeline"
          defaultValue={defaultName}
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}description`}>Description</Label>
        <Input
          id={`${pre}description`}
          name={`${pre}description`}
          type="text"
          placeholder="Optional description"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </div>
      <FormBooleanCheckboxField
        name={`${pre}isActive`}
        id={`${pre}isActive`}
        defaultChecked={defaultIsActive}
        disabled={pending}
        label="Active"
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
