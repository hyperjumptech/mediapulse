/**
 * Merges Hermes-local dashboard pages into a domain integration's manifest-derived nav.
 */

import type { DashboardPage } from "@hermes/domain-contract";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { integrationSupportsHermesDataSourceExpansionTemplates } from "./data-source-expansion-template-capabilities";
import { integrationSupportsOperatorDiagnostics } from "./operator-diagnostics-capabilities";
import {
  buildSyntheticDataSourceExpansionsDashboardPage,
  DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
} from "./data-source-expansion-template-meta";
import { loadHermesDashboardExtensions } from "./load-hermes-dashboard-extensions";

/**
 * Returns manifest pages plus Hermes-only entries (e.g. data source expansion templates)
 * when the integration supports them and does not already advertise the page.
 *
 * @param integration - Parsed domain integration record.
 * @returns Pages for sidebar navigation, ordered by `order`.
 */
export const mergeDomainIntegrationNavPages = async (
  integration: DomainIntegrationRecord,
): Promise<DashboardPage[]> => {
  const pages = [...integration.dashboard.pages];
  const hasDataSourceExpansions = pages.some(
    (p) => p.pathSegment === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
  );
  if (
    !hasDataSourceExpansions &&
    integrationSupportsHermesDataSourceExpansionTemplates(
      integration.capabilities,
    )
  ) {
    pages.push(buildSyntheticDataSourceExpansionsDashboardPage());
  }
  if (integrationSupportsOperatorDiagnostics(integration.capabilities)) {
    const extensions = await loadHermesDashboardExtensions();
    if (extensions) {
      pages.push(...extensions.buildOperatorDiagnosticsNavPages());
    }
  }
  return pages.sort((a, b) => a.order - b.order);
};
