import { withAuthProtection } from "@/components/with-auth-protection";

import { CreatePipelineForm } from "./create-pipeline-form";

/**
 * New pipeline page. Renders a form to create a pipeline; on success redirects to edit page to add steps.
 */
const NewPipelinePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Create pipeline
        </h1>
        <p className="text-muted-foreground">
          Add a new pipeline. You can add agent steps on the next page.
        </p>
      </div>
      <CreatePipelineForm />
    </div>
  );
};

export default withAuthProtection(NewPipelinePage);
