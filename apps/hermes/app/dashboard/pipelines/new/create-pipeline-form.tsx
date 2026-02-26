"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/pipelines/actions/create/.generated/use-form-action";

/**
 * Form state derived from the create pipeline form action.
 */
const useCreatePipelineFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }
    return null;
  }, [state]);

  const createdId = useMemo(() => {
    if (state && state.status === true && state.data?.id) {
      return state.data.id as string;
    }
    return null;
  }, [state]);

  return {
    FormWithAction,
    pending,
    errorMessage,
    createdId,
  };
};

/**
 * Create pipeline form: name, description, isActive. On success redirects to pipeline edit page.
 */
export const CreatePipelineForm = () => {
  const router = useRouter();
  const { FormWithAction, pending, errorMessage, createdId } =
    useCreatePipelineFormState();

  useEffect(() => {
    if (!createdId) return;
    router.replace(`/dashboard/pipelines/${createdId}`);
  }, [createdId, router]);

  return (
    <FormWithAction className="flex flex-col gap-4 max-w-md">
      <div className="grid gap-2">
        <Label htmlFor="body.name">Name</Label>
        <Input
          id="body.name"
          name="body.name"
          type="text"
          required
          placeholder="My pipeline"
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body.description">Description</Label>
        <Input
          id="body.description"
          name="body.description"
          type="text"
          placeholder="Optional description"
          disabled={pending}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="body.isActive"
          name="body.isActive"
          type="checkbox"
          defaultChecked
          value="on"
          disabled={pending}
          className="h-4 w-4 rounded border border-input"
        />
        <Label htmlFor="body.isActive">Active</Label>
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create pipeline"}
      </Button>
    </FormWithAction>
  );
};
