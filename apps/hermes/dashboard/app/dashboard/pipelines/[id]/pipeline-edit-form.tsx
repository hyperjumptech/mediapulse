"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/pipelines/actions/update/.generated/use-form-action";
import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";

/**
 * Encapsulates pipeline edit form action state and refresh-on-success.
 */
const usePipelineEditFormState = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return { FormWithAction, pending, errorMessage };
};

/**
 * Edit pipeline form: name, description, isActive. Uses update action; refreshes on success.
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
    <FormWithAction className="flex flex-col gap-4 max-w-md">
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          defaultValue={initialName}
          required
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.description">Description</Label>
        <Input
          id="body.description"
          name="body.description"
          type="text"
          defaultValue={initialDescription}
          disabled={pending}
        />
      </div>
      <FormBooleanCheckboxField
        name="body.isActive"
        id="body.isActive"
        defaultChecked={initialIsActive}
        disabled={pending}
        label="Active"
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </FormWithAction>
  );
};
