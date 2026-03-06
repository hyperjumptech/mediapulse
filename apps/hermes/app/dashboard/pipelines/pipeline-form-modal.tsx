"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

import { getPipelineForEdit } from "@/app/dashboard/pipelines/actions/get-for-edit";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/pipelines/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/pipelines/actions/update/.generated/use-form-action";

import { PipelineFormFields } from "./pipeline-form-fields";
import type { PipelineForEdit } from "@/app/dashboard/pipelines/actions/get-for-edit";

export type PipelineFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editPipelineId: string | null;
};

/**
 * Modal for creating or editing a pipeline. Uses shared PipelineFormFields with create or update action based on mode.
 * For edit mode, fetches pipeline when opened and shows loading until data is ready.
 */
export const PipelineFormModal = ({
  open,
  onOpenChange,
  mode,
  editPipelineId,
}: PipelineFormModalProps) => {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<PipelineForEdit | null | "loading">(
    null,
  );

  const {
    FormWithAction: CreateForm,
    state: createState,
    pending: createPending,
  } = useCreateFormAction();
  const {
    FormWithAction: UpdateForm,
    state: updateState,
    pending: updatePending,
  } = useUpdateFormAction();

  const isEdit = mode === "edit";
  const pending = isEdit ? updatePending : createPending;
  const state = isEdit ? updateState : createState;

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  const success = useMemo(
    () => state != null && state.status === true,
    [state],
  );

  const fetchPipeline = useCallback(async (id: string) => {
    setPipeline("loading");
    const data = await getPipelineForEdit(id);
    setPipeline(data);
  }, []);

  useEffect(() => {
    if (open && isEdit && editPipelineId) {
      void fetchPipeline(editPipelineId);
    } else if (!open) {
      setPipeline(null);
    }
  }, [open, isEdit, editPipelineId, fetchPipeline]);

  useEffect(() => {
    if (success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [success, onOpenChange, router]);

  const Form = isEdit ? UpdateForm : CreateForm;
  const title = isEdit ? "Edit pipeline" : "Create pipeline";
  const submitLabel = pending
    ? isEdit
      ? "Saving…"
      : "Creating…"
    : isEdit
      ? "Save changes"
      : "Create pipeline";

  const formFieldsProps = isEdit
    ? pipeline && pipeline !== "loading"
      ? {
          defaultName: pipeline.name,
          defaultDescription: pipeline.description ?? "",
          defaultIsActive: pipeline.isActive,
          pipelineId: pipeline.id,
        }
      : {
          defaultName: "",
          defaultDescription: "",
          defaultIsActive: true,
          pipelineId: undefined as string | undefined,
        }
    : {
        defaultName: "",
        defaultDescription: "",
        defaultIsActive: true,
        pipelineId: undefined as string | undefined,
      };

  const isLoadingEdit = isEdit && pipeline === "loading";
  const canShowForm =
    mode === "create" || (pipeline !== null && pipeline !== "loading");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {isLoadingEdit ? (
          <p className="text-muted-foreground">Loading pipeline…</p>
        ) : canShowForm ? (
          <Form className="flex flex-col gap-4">
            <PipelineFormFields
              namePrefix="body"
              pending={pending}
              errorMessage={errorMessage}
              submitLabel={submitLabel}
              {...formFieldsProps}
            />
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
