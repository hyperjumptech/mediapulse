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
import type { PipelineDomainIntegrationOption } from "./pipelines-with-modal";

export type PipelineFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editPipelineId: string | null;
  domainIntegrations: PipelineDomainIntegrationOption[];
};

/**
 * Encapsulates pipeline form modal state: fetch for edit, create/update form actions, success close.
 */
const usePipelineFormModalState = ({
  open,
  onOpenChange,
  mode,
  editPipelineId,
  domainIntegrations,
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
          defaultTimeoutMs: pipeline.timeout ?? undefined,
          defaultDomainIntegrationId: pipeline.domainIntegrationId,
          pipelineId: pipeline.id,
        }
      : {
          defaultName: "",
          defaultDescription: "",
          defaultIsActive: true,
          defaultTimeoutMs: undefined,
          defaultDomainIntegrationId: undefined as string | undefined,
          pipelineId: undefined as string | undefined,
        }
    : {
        defaultName: "",
        defaultDescription: "",
        defaultIsActive: true,
        defaultTimeoutMs: undefined,
        defaultDomainIntegrationId: undefined as string | undefined,
        pipelineId: undefined as string | undefined,
      };

  const isLoadingEdit = isEdit && pipeline === "loading";
  const notFound = isEdit && pipeline === null;
  const canShowForm =
    mode === "create" || (pipeline !== null && pipeline !== "loading");

  return {
    Form,
    title,
    pending,
    errorMessage,
    submitLabel,
    formFieldsProps,
    domainIntegrations,
    isLoadingEdit,
    notFound,
    canShowForm,
  };
};

/**
 * Modal for creating or editing a pipeline. Uses shared PipelineFormFields with create or update action based on mode.
 * For edit mode, fetches pipeline when opened and shows loading until data is ready.
 */
export const PipelineFormModal = (props: PipelineFormModalProps) => {
  const { open, onOpenChange } = props;
  const {
    Form,
    title,
    pending,
    errorMessage,
    submitLabel,
    formFieldsProps,
    domainIntegrations,
    isLoadingEdit,
    notFound,
    canShowForm,
  } = usePipelineFormModalState(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-hidden p-0">
        <div className="flex max-h-[85vh] min-h-80 flex-col overflow-y-hidden px-6 pt-10 pb-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4 px-1">
            {isLoadingEdit ? (
              <p className="text-muted-foreground">Loading pipeline…</p>
            ) : notFound ? (
              <p className="text-muted-foreground">Pipeline not found.</p>
            ) : canShowForm ? (
              <Form className="flex flex-col gap-4">
                <PipelineFormFields
                  namePrefix="body"
                  pending={pending}
                  errorMessage={errorMessage}
                  submitLabel={submitLabel}
                  domainIntegrations={domainIntegrations}
                  {...formFieldsProps}
                />
              </Form>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
