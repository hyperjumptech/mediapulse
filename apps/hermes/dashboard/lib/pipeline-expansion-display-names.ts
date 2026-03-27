import { collectDataSourceExpansionReferenceIds } from "@hermes/step-input-syntax";
import {
  prisma,
  type Prisma,
  type PrismaClient,
} from "@hermes/orchestration-database";

type PipelineStepWithInput = {
  input: unknown;
};

/**
 * Collects unique `{{dse:<id>}}` template ids from all pipeline steps’ input JSON.
 *
 * @param steps - Pipeline steps with optional `input` JSON.
 * @returns Distinct template ids referenced in step input.
 */
export const collectDataSourceExpansionTemplateIdsFromPipelineSteps = (
  steps: readonly PipelineStepWithInput[],
): string[] => {
  const ids = new Set<string>();
  for (const step of steps) {
    const input = step.input;
    if (input == null || typeof input !== "object" || Array.isArray(input)) {
      continue;
    }
    for (const id of collectDataSourceExpansionReferenceIds(
      input as Record<string, unknown>,
    )) {
      ids.add(id);
    }
  }
  return [...ids];
};

type ExpansionTemplateDelegate = Pick<
  PrismaClient["dataSourceExpansionTemplate"],
  "findMany"
>;

export type GetExpansionDisplayNamesForPipelineDependencies = {
  db?: ExpansionTemplateDelegate;
};

/**
 * Loads display names for data-source expansion template ids used in pipeline step input,
 * scoped to the pipeline’s domain integration.
 *
 * @param domainIntegrationId - Pipeline’s `domain_integration_id`.
 * @param templateIds - Template row ids (from `{{dse:<id>}}` tokens).
 * @param dependencies - Injectable DB delegate for tests.
 * @returns Map of template id → name for labels in the variable expansion UI.
 */
export const getExpansionDisplayNamesForPipeline = async (
  domainIntegrationId: string,
  templateIds: readonly string[],
  dependencies: GetExpansionDisplayNamesForPipelineDependencies = {},
): Promise<Record<string, string>> => {
  if (templateIds.length === 0) {
    return {};
  }
  const db = dependencies.db ?? prisma.dataSourceExpansionTemplate;
  const args = {
    where: {
      domainIntegrationId,
      id: { in: [...templateIds] },
    },
    select: { id: true, name: true },
  } satisfies Prisma.DataSourceExpansionTemplateFindManyArgs;

  const rows = await db.findMany(args);
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
};
