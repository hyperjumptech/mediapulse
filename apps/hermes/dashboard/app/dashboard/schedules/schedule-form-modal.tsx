"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

import { getScheduleForEdit } from "@/app/dashboard/schedules/actions/get-for-edit";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/schedules/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/schedules/actions/update/.generated/use-form-action";

import type { PipelineValidationResult } from "@/lib/validate-pipeline";

import {
  ScheduleFormFields,
  type PipelineOption,
} from "./schedule-form-fields";
import type { ScheduleForEdit } from "@/app/dashboard/schedules/actions/get-for-edit";

export type ScheduleFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editScheduleId: string | null;
  pipelines: PipelineOption[];
  pipelineValidationById: Record<string, PipelineValidationResult>;
};

/**
 * Converts ISO startAt to datetime-local string for the form.
 */
const toDatetimeLocal = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Encapsulates schedule form modal state: fetch for edit, create/update form actions, success close.
 */
const useScheduleFormModalState = (props: ScheduleFormModalProps) => {
  const {
    open,
    onOpenChange,
    mode,
    editScheduleId,
    pipelines,
    pipelineValidationById,
  } = props;
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleForEdit | null | "loading">(
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
    if (
      state &&
      typeof state === "object" &&
      "status" in state &&
      state.status === false
    )
      return (state as { message?: string }).message ?? "Something went wrong";
    if (state instanceof Error) return state.message;
    return null;
  }, [state]);

  const success = useMemo(
    () =>
      state != null &&
      typeof state === "object" &&
      "status" in state &&
      state.status === true,
    [state],
  );

  const didHandleSuccess = useRef(true);

  const fetchSchedule = useCallback(async (id: string) => {
    setSchedule("loading");
    const data = await getScheduleForEdit(id);
    setSchedule(data);
  }, []);

  useEffect(() => {
    if (open && isEdit && editScheduleId) {
      void fetchSchedule(editScheduleId);
    } else if (!open) {
      setSchedule(null);
    }
  }, [open, isEdit, editScheduleId, fetchSchedule]);

  useEffect(() => {
    if (open) didHandleSuccess.current = true;
  }, [open]);

  useEffect(() => {
    if (pending) didHandleSuccess.current = false;
  }, [pending]);

  useEffect(() => {
    if (success && !didHandleSuccess.current) {
      didHandleSuccess.current = true;
      onOpenChange(false);
      router.refresh();
    }
  }, [success, onOpenChange, router]);

  const Form = isEdit ? UpdateForm : CreateForm;
  const title = isEdit ? "Edit schedule" : "Create schedule";
  const submitLabel = pending
    ? isEdit
      ? "Saving…"
      : "Creating…"
    : isEdit
      ? "Save changes"
      : "Create schedule";

  const defaultStartAt =
    schedule && schedule !== "loading" ? toDatetimeLocal(schedule.startAt) : "";
  const defaultRetryConfig =
    schedule && schedule !== "loading" && schedule.retryConfig != null
      ? JSON.stringify(schedule.retryConfig, null, 2)
      : "";
  const defaultExecutionConfig =
    schedule && schedule !== "loading" && schedule.executionConfig != null
      ? JSON.stringify(schedule.executionConfig, null, 2)
      : "";

  const formFieldsProps = isEdit
    ? schedule && schedule !== "loading"
      ? {
          scheduleId: schedule.id,
          defaultName: schedule.name,
          defaultDescription: schedule.description ?? "",
          defaultRepeat: schedule.repeat,
          defaultTimezone: schedule.timezone,
          defaultPipelineId: schedule.pipelineId,
          defaultPriority: schedule.priority,
          defaultEnabled: schedule.enabled,
          defaultStartAt,
          initialIntervalMs: schedule.interval ?? undefined,
          initialCronExpression: schedule.cronExpression ?? undefined,
          defaultRetryConfig,
          defaultExecutionConfig,
          defaultTimeout: schedule.timeout ?? undefined,
        }
      : null
    : {
        defaultName: "",
        defaultDescription: "",
        defaultRepeat: "repeating" as const,
        defaultTimezone: "America/New_York",
        defaultPipelineId: "",
        defaultPriority: 0,
        defaultEnabled: true,
        defaultExecutionConfig: "",
      };

  const isLoadingEdit = isEdit && schedule === "loading";
  const notFound = isEdit && schedule === null;
  const canShowForm =
    mode === "create" || (schedule !== null && schedule !== "loading");

  return {
    Form,
    title,
    pending,
    errorMessage,
    submitLabel,
    formFieldsProps,
    isLoadingEdit,
    notFound,
    canShowForm,
    pipelines,
    pipelineValidationById,
  };
};

/**
 * Modal for creating or editing a schedule. Uses a single form with create or update action based on mode.
 * For edit mode, fetches schedule when opened and shows loading until data is ready.
 */
export const ScheduleFormModal = (props: ScheduleFormModalProps) => {
  const { open, onOpenChange } = props;
  const {
    Form,
    title,
    pending,
    errorMessage,
    submitLabel,
    formFieldsProps,
    isLoadingEdit,
    notFound,
    canShowForm,
    pipelines,
    pipelineValidationById,
  } = useScheduleFormModalState(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-hidden p-0">
        <div className="flex max-h-[85vh] min-h-80 flex-col overflow-y-hidden px-6 pt-10 pb-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-4 px-1">
            {isLoadingEdit ? (
              <p className="text-muted-foreground">Loading schedule…</p>
            ) : notFound ? (
              <p className="text-muted-foreground">Schedule not found.</p>
            ) : canShowForm && formFieldsProps ? (
              <Form className="flex flex-col gap-4">
                <ScheduleFormFields
                  namePrefix="body"
                  pending={pending}
                  errorMessage={errorMessage}
                  submitLabel={submitLabel}
                  pipelines={pipelines}
                  pipelineValidationById={pipelineValidationById}
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
