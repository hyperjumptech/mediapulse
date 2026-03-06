import Link from "next/link";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";

import { CreateScheduleForm } from "./create-schedule-form";

/**
 * New schedule page. Renders create form with pipeline dropdown.
 */
const NewSchedulePage = async () => {
  const pipelines = await getPipelinesWithSteps();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Create schedule
        </h1>
        <p className="text-muted-foreground">
          Configure when and how a pipeline runs. Use cron or interval for
          repeating runs.
        </p>
      </div>
      {pipelines.length === 0 ? (
        <p className="text-muted-foreground">
          No pipelines yet.{" "}
          <Link
            href="/dashboard/pipelines/new"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Create a pipeline
          </Link>{" "}
          first, then add a schedule.
        </p>
      ) : (
        <CreateScheduleForm pipelines={pipelines} />
      )}
    </div>
  );
};

export default withAuthProtection(NewSchedulePage);
