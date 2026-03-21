import { dashboardManifestSchema } from "@hermes/domain-contract";
import { dataSourceExpansionsDashboardPage } from "../resources/data-source-expansions/tables/dashboard-page";
import { entityTypesDashboardPage } from "../resources/entity-types/tables/dashboard-page";
import { mediapulseUsersDashboardPage } from "../resources/mediapulse-users/tables/dashboard-page";
import { relationTypesDashboardPage } from "../resources/relation-types/tables/dashboard-page";
import { searchQueriesDashboardPage } from "../resources/search-queries/tables/dashboard-page";
import { tickersDashboardPage } from "../resources/tickers/tables/dashboard-page";

/**
 * Hermes domain-dashboard manifest for Mediapulse, validated at load time against the domain contract schema.
 *
 * @remarks
 * Each `table-v1` page lives under `src/<resource>/tables/` next to that resource's HTTP routes.
 */
export const dashboardManifest = dashboardManifestSchema.parse({
  templateVersion: 1,
  pages: [
    tickersDashboardPage,
    mediapulseUsersDashboardPage,
    entityTypesDashboardPage,
    relationTypesDashboardPage,
    searchQueriesDashboardPage,
    dataSourceExpansionsDashboardPage,
  ],
});
