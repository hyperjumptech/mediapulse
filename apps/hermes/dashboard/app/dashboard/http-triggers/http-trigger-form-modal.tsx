"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "@workspace/ui/components/dialog";
import type { PipelineOption } from "../schedules/schedule-form-fields";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";
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
import {
  getHttpTriggerForEdit,
  type HttpTriggerForEdit,
} from "./actions/get-for-edit";
import { useFormAction as useCreateFormAction } from "./actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "./actions/update/.generated/use-form-action";
import { HttpTriggerFormFields } from "./http-trigger-form-fields";

export type HttpTriggerFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editHttpTriggerId: string | null;
  pipelines: PipelineOption[];
};

const useHttpTriggerFormModalState = ({
  open,
  mode,
  editHttpTriggerId,
  onOpenChange,
}: HttpTriggerFormModalProps) => {
  const [httpTrigger, setHttpTrigger] = useState<
    HttpTriggerForEdit | null | "loading"
  >(null);
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
  const Form = isEdit ? UpdateForm : CreateForm;
  const fetchTrigger = useCallback(async (id: string) => {
    setHttpTrigger("loading");
    const row = await getHttpTriggerForEdit(id);
    setHttpTrigger(row);
  }, []);

  useEffect(() => {
    if (open && isEdit && editHttpTriggerId)
      void fetchTrigger(editHttpTriggerId);
    if (!open) setHttpTrigger(null);
  }, [open, isEdit, editHttpTriggerId, fetchTrigger]);

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (next) =>
      Boolean(
        next &&
        typeof next === "object" &&
        "status" in next &&
        next.status === true,
      ),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const errorMessage = useMemo(() => {
    if (
      state &&
      typeof state === "object" &&
      "status" in state &&
      state.status === false
    ) {
      return (state as { message?: string }).message ?? "Something went wrong";
    }
    if (state instanceof Error) return state.message;
    return null;
  }, [state]);

  const closeModal = useCallback(() => onOpenChange(false), [onOpenChange]);
  const loadedTrigger =
    httpTrigger && httpTrigger !== "loading" ? httpTrigger : null;

  return {
    Form,
    isEdit,
    pending,
    errorMessage,
    httpTrigger,
    loadedTrigger,
    closeModal,
    submitLabel: isEdit ? "Save changes" : "Create HTTP trigger",
    pendingLabel: isEdit ? "Saving..." : "Creating...",
    title: isEdit ? "Edit HTTP trigger" : "Create HTTP trigger",
  };
};

/**
 * Create/edit modal for HTTP trigger.
 */
export const HttpTriggerFormModal = (props: HttpTriggerFormModalProps) => {
  const { open, onOpenChange, pipelines } = props;
  const {
    Form,
    isEdit,
    pending,
    errorMessage,
    httpTrigger,
    loadedTrigger,
    closeModal,
    submitLabel,
    pendingLabel,
    title,
  } = useHttpTriggerFormModalState(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <FormDialogHeader title={title} />
        {isEdit && httpTrigger === "loading" ? (
          <FormDialogMessage loading>Loading trigger...</FormDialogMessage>
        ) : isEdit && httpTrigger === null ? (
          <FormDialogMessage>HTTP trigger not found.</FormDialogMessage>
        ) : (
          <Form className={formDialogFormClassName}>
            <FormDialogBody>
              <HttpTriggerFormFields
                pending={pending}
                pipelines={pipelines}
                defaultName={loadedTrigger?.name ?? ""}
                defaultDescription={loadedTrigger?.description ?? ""}
                defaultPipelineId={loadedTrigger?.pipelineId ?? ""}
                defaultEnabled={loadedTrigger?.enabled ?? true}
                defaultMethod={loadedTrigger?.method ?? "POST"}
                defaultTokenHint={loadedTrigger?.tokenHint ?? null}
                httpTriggerId={loadedTrigger?.id}
                isEdit={isEdit}
              />
            </FormDialogBody>
            <FormDialogFooter errorMessage={errorMessage}>
              <FormDialogCancelButton
                onCancel={closeModal}
                disabled={pending}
              />
              <SubmitButton pending={pending} pendingLabel={pendingLabel}>
                {submitLabel}
              </SubmitButton>
            </FormDialogFooter>
          </Form>
        )}
      </FormDialogContent>
    </Dialog>
  );
};
