"use client";

import { useMemo } from "react";

import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useFormAction } from "@/app/dashboard/pipelines/actions/update/.generated/use-form-action";
import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

/**
 * Encapsulates pipeline edit form action state.
 */
const usePipelineEditFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  return { FormWithAction, pending, errorMessage };
};

/**
 * Edit pipeline form: name, description, isActive. Uses the update action.
 */
export const PipelineEditForm = ({
  pipelineId,
  initialName,
  initialDescription,
  initialIsActive,
}: {
  pipelineId: string;
  initialName: string;
  initialDescription: string;
  initialIsActive: boolean;
}) => {
  const { FormWithAction, pending, errorMessage } = usePipelineEditFormState();

  return (
    <FormWithAction className="flex max-w-md flex-col gap-6">
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="body.name">Name</FieldLabel>
          <Input
            id="body.name"
            name="body.name"
            type="text"
            defaultValue={initialName}
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="body.description">Description</FieldLabel>
          <Input
            id="body.description"
            name="body.description"
            type="text"
            defaultValue={initialDescription}
            disabled={pending}
          />
        </Field>
        <FormBooleanCheckboxField
          name="body.isActive"
          id="body.isActive"
          defaultChecked={initialIsActive}
          disabled={pending}
          label="Active"
        />
      </FieldGroup>
      {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </FormWithAction>
  );
};
