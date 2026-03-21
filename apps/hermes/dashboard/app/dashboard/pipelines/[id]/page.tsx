import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigsByAgentKeys } from "@/lib/agent-configs";
import { getDataSourceExpansionsPage } from "@/lib/data-source-expansions";
import { getAgentRegistryList, getPipelineWithSteps } from "@/lib/pipelines";
import { getVariablesPage } from "@/lib/variables";
import { validatePipeline } from "@/lib/validate-pipeline";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { PipelineDetailContent } from "./pipeline-detail-content";

/** Max items to load for variable/expansion pickers on the pipeline step editor. */
const PICKER_PAGE_SIZE = 500;

/**
 * Loads expansion templates for pipeline step inputs via domain integration HTTP.
 * Falls back to an empty list when the domain API is unavailable.
 *
 * @returns Expansion templates for step editors.
 */
const getExpansionTemplates = async (): Promise<
  Array<{
    id: string;
    name: string;
    expansionString: string;
  }>
> => {
  try {
    const { getDefaultDomainIntegration } =
      await import("@/lib/domain-integrations");
    const integration = await getDefaultDomainIntegration();
    const expansionsPage = await getDataSourceExpansionsPage(
      integration.key,
      1,
      PICKER_PAGE_SIZE,
      undefined,
    );

    return expansionsPage.expansions.map((expansion) => ({
      id: expansion.id,
      name: expansion.name,
      expansionString: expansion.expansionString,
    }));
  } catch {
    return [];
  }
};

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
      getExpansionTemplates(),
    ]);

  const variableKeys = variablesPage.variables.map((v) => ({ key: v.key }));
  const expansionTemplates = expansionsPage;

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
