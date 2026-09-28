import { prisma } from "@hermes/orchestration-database";

import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  DOMAIN_INTEGRATIONS_DEFAULT_COLUMN_VISIBILITY,
  DOMAIN_INTEGRATIONS_TABLE_ID,
} from "./domain-integrations-table-defaults";
import { DomainIntegrationsTable } from "./domain-integrations-table";

export const DomainIntegrationsSection = async () => {
  const [integrations, savedVisibility] = await Promise.all([
    withDashboardAdmin(
      prisma.domainIntegration.findMany({
        orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
        select: {
          id: true,
          integrationId: true,
          name: true,
          status: true,
          baseUrl: true,
        },
      }),
    ),
    readColumnVisibility(DOMAIN_INTEGRATIONS_TABLE_ID),
  ]);

  return (
    <DomainIntegrationsTable
      integrations={integrations}
      initialColumnVisibility={mergeColumnVisibility(
        DOMAIN_INTEGRATIONS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
