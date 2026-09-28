import { notFound } from "next/navigation";

import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { PageHeader } from "@/components/page-header";
import { getAgentConfigById } from "@/lib/agent-configs";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "@/lib/variable-expansion-picker-actions";

import { EditConfigPageClient } from "./edit-config-page-client";

const EditConfigPage = async ({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) => {
  const { id } = await Promise.resolve(params);

  const [config, agentsForDropdown] = await withDashboardAdmin(
    Promise.all([
      getAgentConfigById(id),
      orchestrationPrisma.agentRegistry.findMany({
        where: { isActive: true },
        select: { id: true, agentId: true, agentVersion: true },
        orderBy: [{ agentId: "asc" }, { agentVersion: "asc" }],
      }),
    ]),
  );

  if (!config) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbEntityLabel segment={id} label={config.name} />
      <PageHeader
        title={`Edit config: ${config.name}`}
        description="Update this agent configuration preset."
      />
      <EditConfigPageClient
        config={config}
        agents={agentsForDropdown}
        pickerLoaders={{
          loadVariablesPage: loadVariablePickerPage,
          loadExpansionsPage: loadExpansionPickerPage,
        }}
      />
    </div>
  );
};

export default EditConfigPage;
