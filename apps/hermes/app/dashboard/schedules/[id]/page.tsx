import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { getScheduleById } from "@/lib/schedules";

import { ScheduleEditForm } from "./schedule-edit-form";

/**
 * Normalizes Prisma JsonValue to object or null for form initial values.
 */
const toJsonObject = (
  value: unknown,
): Record<string, unknown> | null | undefined => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

/**
 * Schedule edit page. Loads schedule by id and all pipelines; renders edit form.
 */
const ScheduleEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const [schedule, pipelines] = await Promise.all([
    getScheduleById(id),
    getPipelinesWithSteps(),
  ]);

  if (!schedule) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Edit schedule: {schedule.name}
        </h1>
        <p className="text-muted-foreground">
          Update when and how this schedule runs the pipeline.
        </p>
      </div>

      <ScheduleEditForm
        scheduleId={schedule.id}
        pipelines={pipelines}
        initialName={schedule.name}
        initialDescription={schedule.description ?? undefined}
        initialRepeat={schedule.repeat}
        initialCronExpression={schedule.cronExpression ?? undefined}
        initialInterval={schedule.interval ?? undefined}
        initialTimezone={schedule.timezone}
        initialStartAt={schedule.startAt ?? undefined}
        initialPipelineId={schedule.pipelineId}
        initialParams={toJsonObject(schedule.params)}
        initialRetryConfig={toJsonObject(schedule.retryConfig)}
        initialTimeout={schedule.timeout ?? undefined}
        initialPriority={schedule.priority}
        initialEnabled={schedule.enabled}
      />
    </div>
  );
};

export default withAuthProtection(ScheduleEditPage);
