"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "@workspace/ui/components/dialog";

import { getPipelineForEdit } from "@/app/dashboard/pipelines/actions/get-for-edit";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/pipelines/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/pipelines/actions/update/.generated/use-form-action";

import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogMessage,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

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
    }
  }, [success, onOpenChange]);

  const Form = isEdit ? UpdateForm : CreateForm;
  const title = isEdit ? "Edit pipeline" : "Create pipeline";
  const submitLabel = isEdit ? "Save changes" : "Create pipeline";
  const pendingLabel = isEdit ? "Saving…" : "Creating…";
  const hasNoDomainIntegrations = domainIntegrations.length === 0;
  const closeModal = useCallback(() => onOpenChange(false), [onOpenChange]);

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
    pendingLabel,
    hasNoDomainIntegrations,
    closeModal,
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
    pendingLabel,
    hasNoDomainIntegrations,
    closeModal,
    formFieldsProps,
    domainIntegrations,
    isLoadingEdit,
    notFound,
    canShowForm,
  } = usePipelineFormModalState(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <FormDialogHeader title={title} />
        {isLoadingEdit ? (
          <FormDialogMessage loading>Loading pipeline…</FormDialogMessage>
        ) : notFound ? (
          <FormDialogMessage>Pipeline not found.</FormDialogMessage>
        ) : canShowForm ? (
          <Form className={formDialogFormClassName}>
            <FormDialogBody>
              <PipelineFormFields
                namePrefix="body"
                pending={pending}
                domainIntegrations={domainIntegrations}
                {...formFieldsProps}
              />
            </FormDialogBody>
            <FormDialogFooter errorMessage={errorMessage}>
              <FormDialogCancelButton
                onCancel={closeModal}
                disabled={pending}
              />
              <SubmitButton
                pending={pending}
                pendingLabel={pendingLabel}
                disabled={hasNoDomainIntegrations}
              >
                {submitLabel}
              </SubmitButton>
            </FormDialogFooter>
          </Form>
        ) : null}
      </FormDialogContent>
    </Dialog>
  );
};
