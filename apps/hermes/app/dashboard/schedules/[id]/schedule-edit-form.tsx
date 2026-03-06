"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useFormAction } from "@/app/dashboard/schedules/actions/update/.generated/use-form-action";

import {
  ScheduleFormFields,
  type PipelineOption,
} from "../schedule-form-fields";

export type ScheduleEditFormProps = {
  scheduleId: string;
  pipelines: PipelineOption[];
  initialName: string;
  initialDescription?: string;
  initialRepeat: "once" | "repeating";
  initialCronExpression?: string;
  initialInterval?: number;
  initialTimezone: string;
  initialStartAt?: Date;
  initialPipelineId: string;
  initialParams?: Record<string, unknown> | null;
  initialRetryConfig?: Record<string, unknown> | null;
  initialTimeout?: number | null;
  initialPriority: number;
  initialEnabled: boolean;
};

/**
 * Edit schedule form. Submits via update action; refreshes on success.
 */
export const ScheduleEditForm = ({
  scheduleId,
  pipelines,
  initialName,
  initialDescription,
  initialRepeat,
  initialCronExpression,
  initialInterval,
  initialTimezone,
  initialStartAt,
  initialPipelineId,
  initialParams,
  initialRetryConfig,
  initialTimeout,
  initialPriority,
  initialEnabled,
}: ScheduleEditFormProps) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  const defaultStartAt = useMemo(() => {
    if (!initialStartAt) return "";
    const d = new Date(initialStartAt);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, [initialStartAt]);

  const defaultParams = useMemo(
    () =>
      initialParams == null ? "{}" : JSON.stringify(initialParams, null, 2),
    [initialParams],
  );
  const defaultRetryConfig = useMemo(
    () =>
      initialRetryConfig == null
        ? ""
        : JSON.stringify(initialRetryConfig, null, 2),
    [initialRetryConfig],
  );

  useEffect(() => {
    if (state?.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <FormWithAction className="flex max-w-2xl flex-col gap-4">
      <ScheduleFormFields
        namePrefix="body"
        pending={pending}
        errorMessage={errorMessage}
        submitLabel={pending ? "Saving…" : "Save changes"}
        pipelines={pipelines}
        defaultName={initialName}
        defaultDescription={initialDescription ?? ""}
        defaultRepeat={initialRepeat}
        defaultTimezone={initialTimezone}
        defaultPipelineId={initialPipelineId}
        defaultParams={defaultParams}
        defaultPriority={initialPriority}
        defaultEnabled={initialEnabled}
        defaultStartAt={defaultStartAt}
        initialIntervalMs={initialInterval ?? undefined}
        initialCronExpression={initialCronExpression ?? undefined}
        scheduleId={scheduleId}
        defaultRetryConfig={defaultRetryConfig}
        defaultTimeout={initialTimeout ?? undefined}
      />
    </FormWithAction>
  );
};
