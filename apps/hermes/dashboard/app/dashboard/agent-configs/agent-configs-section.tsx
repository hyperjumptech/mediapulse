import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import {
  getAgentConfigsPage,
  type AgentConfigsPageResult,
  type AgentConfigSortDir,
  type AgentConfigSortField,
} from "@/lib/agent-configs";
import { configSchemaFingerprint } from "@/lib/config-schema-fingerprint";
import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentConfigsTable } from "./agent-configs-table";
import {
  AGENT_CONFIGS_DEFAULT_COLUMN_VISIBILITY,
  AGENT_CONFIGS_TABLE_ID,
} from "./agent-configs-table-defaults";

export type AgentConfigsQuery = {
  page: number;
  pageSize: number;
  sortBy: AgentConfigSortField;
  sortDir: AgentConfigSortDir;
};

type AgentConfig = AgentConfigsPageResult["configs"][number];

type AgentVersion = {
  agentId: string;
  agentVersion: string;
};

const fingerprintKey = ({ agentId, agentVersion }: AgentVersion) =>
  `${agentId}:${agentVersion}`;

const loadCurrentFingerprintByKey = async (
  configs: AgentConfig[],
): Promise<Map<string, string>> => {
  const agentVersionsByKey = new Map<string, AgentVersion>();
  for (const config of configs) {
    agentVersionsByKey.set(`${config.agentId}\0${config.agentVersion}`, {
      agentId: config.agentId,
      agentVersion: config.agentVersion,
    });
  }
  const agentVersions = [...agentVersionsByKey.values()];
  const agents =
    agentVersions.length > 0
      ? await orchestrationPrisma.agentRegistry.findMany({
          where: { OR: agentVersions, isActive: true },
          select: { agentId: true, agentVersion: true, configSchema: true },
        })
      : [];
  const currentFingerprintByKey = new Map<string, string>();
  for (const agent of agents) {
    const fingerprint = configSchemaFingerprint(
      agent.configSchema as Record<string, unknown> | null,
    );
    currentFingerprintByKey.set(fingerprintKey(agent), fingerprint);
  }

  return currentFingerprintByKey;
};

export const AgentConfigsSection = async ({
  page,
  pageSize,
  sortBy,
  sortDir,
}: AgentConfigsQuery) => {
  const [configsResult, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      getAgentConfigsPage(page, pageSize, { sortBy, sortDir }),
    ),
    readColumnVisibility(AGENT_CONFIGS_TABLE_ID),
  ]);
  const currentFingerprintByKey = await loadCurrentFingerprintByKey(
    configsResult.configs,
  );
  const configsWithStatus = configsResult.configs.map((config) => {
    const currentFingerprint = currentFingerprintByKey.get(
      fingerprintKey(config),
    );
    const schemaValid =
      config.configSchemaFingerprint == null ||
      currentFingerprint === "" ||
      config.configSchemaFingerprint === currentFingerprint;

    return { ...config, schemaValid };
  });

  return (
    <AgentConfigsTable
      configs={configsWithStatus}
      urlState={{
        basePath: "/dashboard/agent-configs",
        page: configsResult.page,
        pageSize: configsResult.pageSize,
        total: configsResult.total,
        sortBy,
        sortDir,
      }}
      initialColumnVisibility={mergeColumnVisibility(
        AGENT_CONFIGS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
