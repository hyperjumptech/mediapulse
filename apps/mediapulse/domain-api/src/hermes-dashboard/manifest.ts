import { dashboardManifestSchema } from "@hermes/domain-contract";
import { dataSourceExpansionsDashboardPage } from "../resources/data-source-expansions/dashboard-page";
import { entityTypesDashboardPage } from "../resources/entity-types/dashboard-page";
import { mediapulseUsersDashboardPage } from "../resources/mediapulse-users/dashboard-page";
import { relationTypesDashboardPage } from "../resources/relation-types/dashboard-page";
import { searchQueriesDashboardPage } from "../resources/search-queries/dashboard-page";
import { tickersDashboardPage } from "../resources/tickers/dashboard-page";

/**
 * Hermes domain-dashboard manifest for Mediapulse, validated at load time against the domain contract schema.
 *
 * @remarks
 * Each `table-v1` page lives next to that resource's HTTP routes under `src/resources/<resource>/`.
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
