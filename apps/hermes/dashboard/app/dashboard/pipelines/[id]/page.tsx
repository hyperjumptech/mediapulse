import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getDataSourceExpansionsPage } from "@/lib/data-source-expansions";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import { getVariablesPage } from "@/lib/variables";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma as mediapulsePrisma } from "@workspace/mediapulse-database";
import { prisma as orchestrationPrisma } from "@workspace/orchestration-database";

import { PipelineDetailContent } from "./pipeline-detail-content";

/** Max items to load for variable/expansion pickers on the pipeline step editor. */
const PICKER_PAGE_SIZE = 500;

/**
 * Pipeline detail page. Loads pipeline with steps, agent registry, validation, agent configs, variables, and expansion templates for step assignment and step input/config editing.
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

  const [configsByAgentKey, validation, variablesPage, expansionsPage] =
    await Promise.all([
      getAgentConfigsByAgentKeys(
        agents.map((a) => ({
          agentId: a.agentId,
          agentVersion: a.agentVersion,
        })),
      ),
      validatePipeline(pipeline, orchestrationPrisma),
      getVariablesPage(1, PICKER_PAGE_SIZE, undefined, orchestrationPrisma),
      getDataSourceExpansionsPage(
        1,
        PICKER_PAGE_SIZE,
        undefined,
        mediapulsePrisma,
      ),
    ]);

  const variableKeys = variablesPage.variables.map((v) => ({ key: v.key }));
  const expansionTemplates = expansionsPage.expansions.map((e) => ({
    id: e.id,
    name: e.name,
    expansionString: e.expansionString,
  }));

  return (
    <PipelineDetailContent
      pipeline={pipeline}
      agents={agents}
      configsByAgentKey={configsByAgentKey}
      pipelineValidation={validation}
      variableKeys={variableKeys}
      expansionTemplates={expansionTemplates}
    />
  );
};

export default withAuthProtection(PipelineDetailPage);
