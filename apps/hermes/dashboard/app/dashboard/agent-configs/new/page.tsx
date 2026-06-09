import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentConfigById } from "@/lib/agent-configs";
import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";

import { AddConfigPageClient } from "./add-config-page-client";

const AddConfigPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }> | { duplicate?: string };
}) => {
  const resolved = await Promise.resolve(searchParams);

  const [agentsForDropdown, duplicateSource] = await Promise.all([
    orchestrationPrisma.agentRegistry.findMany({
      where: { isActive: true },
      select: { id: true, agentId: true, agentVersion: true },
      orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
    }),
    resolved.duplicate ? getAgentConfigById(resolved.duplicate) : null,
  ]);

  const initialData = duplicateSource
    ? {
        name: `Copy of ${duplicateSource.name}`,
        description: duplicateSource.description ?? "",
        agentKey: `${duplicateSource.agentId}@${duplicateSource.agentVersion}`,
        config:
          typeof duplicateSource.config === "object" &&
          duplicateSource.config !== null
            ? { ...(duplicateSource.config as Record<string, unknown>) }
            : {},
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={initialData ? "Duplicate config" : "Add config"}
        description="Create a new agent configuration preset."
      />
      <AddConfigPageClient
        agents={agentsForDropdown}
        pickerLoaders={{
          loadVariablesPage: loadVariablePickerPage,
          loadExpansionsPage: loadExpansionPickerPage,
        }}
        initialData={initialData}
      />
    </div>
  );
};

export default withAuthProtection(AddConfigPage);
