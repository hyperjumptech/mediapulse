import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import {
  getAgentConfigsPage,
  type AgentConfigSortDir,
  type AgentConfigSortField,
} from "@/lib/agent-configs";
import { getDataSourceExpansionsPage } from "@/lib/data-source-expansions";
import { getVariablesPage } from "@/lib/variables";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { configSchemaFingerprint } from "@/lib/config-schema-fingerprint";

import { AgentConfigsContent } from "./agent-configs-content";

const DEFAULT_PAGE_SIZE = 15;
const PICKER_PAGE_SIZE = 500;

const SORT_FIELDS: AgentConfigSortField[] = ["name", "createdAt", "agentId"];
const SORT_DIRS: AgentConfigSortDir[] = ["asc", "desc"];

/**
 * Loads expansion templates for picker inputs via domain integration HTTP.
 * Falls back to an empty list when the domain API is unavailable.
 *
 * @returns Expansion templates for form pickers.
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

const parseSort = (
  sort?: string,
  dir?: string,
): {
  sortBy: AgentConfigSortField;
  sortDir: AgentConfigSortDir;
} => {
  const sortBy = SORT_FIELDS.includes(sort as AgentConfigSortField)
    ? (sort as AgentConfigSortField)
    : "name";
  const sortDir = SORT_DIRS.includes(dir as AgentConfigSortDir)
    ? (dir as AgentConfigSortDir)
    : "asc";
  return { sortBy, sortDir };
};

/**
 * Agent configs list page. Fetches paginated configs and renders table with edit/duplicate/delete.
 * Shows "Schema changed" when agent's config schema has changed since config was saved.
 */
const AgentConfigsPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        sort?: string;
        dir?: string;
      }>
    | { page?: string; size?: string; sort?: string; dir?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  const { sortBy, sortDir } = parseSort(resolved.sort, resolved.dir);

  const [
    { configs, total, page: currentPage, pageSize: size },
    agentsForDropdown,
    variablesPage,
    expansionTemplates,
  ] = await Promise.all([
    getAgentConfigsPage(page, pageSize, { sortBy, sortDir }),
    orchestrationPrisma.agentRegistry.findMany({
      where: { isActive: true },
      select: { id: true, agentId: true, agentVersion: true },
      orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
    }),
    getVariablesPage(1, PICKER_PAGE_SIZE, undefined, orchestrationPrisma),
    getExpansionTemplates(),
  ]);
  const variableKeys = variablesPage.variables.map((v) => ({ key: v.key }));

  const agentKeys = [
    ...new Set(configs.map((c) => `${c.agentId}\0${c.agentVersion}`)),
  ];
  const agents =
    agentKeys.length > 0
      ? await orchestrationPrisma.agentRegistry.findMany({
          where: {
            OR: agentKeys.map((key) => {
              const [agentId, agentVersion] = key.split("\0");
              return { agentId: agentId!, agentVersion: agentVersion! };
            }),
            isActive: true,
          },
          select: { agentId: true, agentVersion: true, configSchema: true },
        })
      : [];
  const currentFingerprintByKey = new Map<string, string>();
  for (const a of agents) {
    const fp = configSchemaFingerprint(
      a.configSchema as Record<string, unknown> | null,
    );
    currentFingerprintByKey.set(`${a.agentId}:${a.agentVersion}`, fp);
  }

  const configsWithStatus = configs.map((c) => {
    const currentFp = currentFingerprintByKey.get(
      `${c.agentId}:${c.agentVersion}`,
    );
    const isValid =
      c.configSchemaFingerprint == null ||
      currentFp === "" ||
      c.configSchemaFingerprint === currentFp;
    return { ...c, schemaValid: isValid };
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agent configs"
        description="Create and manage agent configuration presets."
      />
      <AgentConfigsContent
        configs={configsWithStatus}
        agents={agentsForDropdown}
        total={total}
        page={currentPage}
        pageSize={size}
        sortBy={sortBy}
        sortDir={sortDir}
        variableKeys={variableKeys}
        expansionTemplates={expansionTemplates}
      />
    </div>
  );
};

export default withAuthProtection(AgentConfigsPage);
