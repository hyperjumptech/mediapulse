import Link from "next/link";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";

import { PipelinesTable } from "./pipelines-table";
import { Button } from "@workspace/ui/components/button";

/**
 * Pipelines list page. Fetches all pipelines with steps and renders an interactive table.
 */
const PipelinesPage = async () => {
  const pipelines = await getPipelinesWithSteps();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/pipelines/new">Create pipeline</Link>
        </Button>
      </div>
      <PipelinesTable pipelines={pipelines} />
    </div>
  );
};

export default withAuthProtection(PipelinesPage);
