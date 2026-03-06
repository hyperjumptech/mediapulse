"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useFormAction } from "@/app/dashboard/schedules/actions/create/.generated/use-form-action";

import {
  ScheduleFormFields,
  type PipelineOption,
} from "../schedule-form-fields";

/**
 * Create schedule form. Submits via create action; redirects to schedules list on success.
 */
export const CreateScheduleForm = ({
  pipelines,
}: {
  pipelines: PipelineOption[];
}) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);
  const createdId = useMemo(() => {
    if (state && state.status === true && state.data?.id)
      return state.data.id as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (!createdId) return;
    router.replace("/dashboard/schedules");
  }, [createdId, router]);

  return (
    <FormWithAction className="flex max-w-2xl flex-col gap-4">
      <ScheduleFormFields
        namePrefix="body"
        pending={pending}
        errorMessage={errorMessage}
        submitLabel={pending ? "Creating…" : "Create schedule"}
        pipelines={pipelines}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="America/New_York"
        defaultPipelineId=""
        defaultParams="{}"
        defaultPriority={0}
        defaultEnabled
      />
    </FormWithAction>
  );
};
