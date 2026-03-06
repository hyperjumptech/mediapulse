import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";

import { PipelineDetailContent } from "./pipeline-detail-content";

/**
 * Pipeline detail page. Loads pipeline with steps and agent registry; renders name/description via edit modal, step list, and add-step control.
 */
const PipelineDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const [pipeline, agents] = await Promise.all([
    getPipelineWithSteps(id),
    getAgentRegistryList(),
  ]);

  if (!pipeline) {
    notFound();
  }

  return <PipelineDetailContent pipeline={pipeline} agents={agents} />;
};

export default withAuthProtection(PipelineDetailPage);
