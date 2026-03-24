"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import type { PipelineOption } from "../schedules/schedule-form-fields";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";
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
  const router = useRouter();
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
      router.refresh();
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

  return {
    Form,
    isEdit,
    pending,
    errorMessage,
    httpTrigger,
    submitLabel: pending
      ? isEdit
        ? "Saving..."
        : "Creating..."
      : isEdit
        ? "Save changes"
        : "Create HTTP trigger",
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
    submitLabel,
    title,
  } = useHttpTriggerFormModalState(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-hidden p-0">
        <div className="flex max-h-[85vh] min-h-80 flex-col overflow-y-hidden px-6 pt-10 pb-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4 px-1">
            {isEdit && httpTrigger === "loading" ? (
              <p className="text-muted-foreground">Loading trigger...</p>
            ) : isEdit && httpTrigger === null ? (
              <p className="text-muted-foreground">HTTP trigger not found.</p>
            ) : (
              <Form className="flex flex-col gap-4">
                <HttpTriggerFormFields
                  pending={pending}
                  errorMessage={errorMessage}
                  submitLabel={submitLabel}
                  pipelines={pipelines}
                  defaultName={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.name
                      : ""
                  }
                  defaultDescription={
                    httpTrigger && httpTrigger !== "loading"
                      ? (httpTrigger.description ?? "")
                      : ""
                  }
                  defaultPipelineId={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.pipelineId
                      : ""
                  }
                  defaultEnabled={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.enabled
                      : true
                  }
                  defaultMethod={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.method
                      : "POST"
                  }
                  defaultTokenHint={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.tokenHint
                      : null
                  }
                  httpTriggerId={
                    httpTrigger && httpTrigger !== "loading"
                      ? httpTrigger.id
                      : undefined
                  }
                  isEdit={isEdit}
                />
              </Form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
