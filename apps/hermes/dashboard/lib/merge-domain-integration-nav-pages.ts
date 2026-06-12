/**
 * Merges Hermes-local dashboard views into a domain integration's manifest-derived sidebar nav.
 */

import type { DashboardView } from "@hermes/domain-contract";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { integrationSupportsHermesDataSourceExpansionTemplates } from "./data-source-expansion-template-capabilities";
import {
  buildSyntheticDataSourceExpansionsDashboardPage,
  DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
} from "./data-source-expansion-template-meta";

/**
 * Returns manifest sidebar views plus Hermes-only entries when supported.
 *
 * @param integration - Parsed domain integration record.
 * @returns Sidebar views for navigation, ordered by `order`.
 */
export const mergeDomainIntegrationNavViews = (
  integration: DomainIntegrationRecord,
): DashboardView[] => {
  const views = integration.dashboard.views.filter(
    (view) => view.placement === "sidebar",
  );
  const hasDataSourceExpansions = views.some(
    (view) => view.pathSegment === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
  );
  if (
    !hasDataSourceExpansions &&
    integrationSupportsHermesDataSourceExpansionTemplates(
      integration.capabilities,
    )
  ) {
    views.push(buildSyntheticDataSourceExpansionsDashboardPage());
  }
  return views.sort((a, b) => a.order - b.order);
};

/** @deprecated Use {@link mergeDomainIntegrationNavViews}. */
export const mergeDomainIntegrationNavPages = mergeDomainIntegrationNavViews;
