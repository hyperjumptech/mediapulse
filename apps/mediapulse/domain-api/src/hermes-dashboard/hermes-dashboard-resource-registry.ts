import { dashboardManifestSchema } from "@hermes/domain-contract";
import type { DashboardPageInput } from "@hermes/domain-contract";
import type { Hono } from "hono";
import { dataSourcesHermesDashboardResource } from "../resources/data-sources/resource-definition";
import { entityTypesHermesDashboardResource } from "../resources/entity-types/resource-definition";
import { mediapulseUsersHermesDashboardResource } from "../resources/mediapulse-users/resource-definition";
import { relationTypesHermesDashboardResource } from "../resources/relation-types/resource-definition";
import { searchQueriesHermesDashboardResource } from "../resources/search-queries/resource-definition";
import { tickersHermesDashboardResource } from "../resources/tickers/resource-definition";
import type { HermesDashboardResourceDefinition } from "./hermes-dashboard-resource-types";

export type { HermesDashboardResourceDefinition };
export { defineHermesDashboardResource } from "./hermes-dashboard-resource-types";

/**
 * Canonical list of Hermes dashboard resources. Add or remove entries here when adding/removing a resource folder.
 */
export const hermesDashboardResources = [
  tickersHermesDashboardResource,
  mediapulseUsersHermesDashboardResource,
  entityTypesHermesDashboardResource,
  relationTypesHermesDashboardResource,
  dataSourcesHermesDashboardResource,
  searchQueriesHermesDashboardResource,
] as const satisfies readonly HermesDashboardResourceDefinition<
  string,
  string
>[];

export type HermesDashboardResourceKey =
  (typeof hermesDashboardResources)[number]["resourceKey"];

export type HermesDashboardSegment =
  (typeof hermesDashboardResources)[number]["pathSegment"];

/**
 * Maps stable camelCase keys to URL path segments (kebab-case where applicable).
 */
export const HermesDashboardResource = buildHermesDashboardResourceConst(
  hermesDashboardResources,
);

/**
 * Hermes domain-dashboard manifest for Mediapulse, validated at load time against the domain contract schema.
 */
export const dashboardManifest = dashboardManifestSchema.parse({
  templateVersion: 1,
  pages: buildDashboardManifestPages(hermesDashboardResources),
});

/**
 * Hono mounts for each dashboard resource (segment + sub-app), sorted by {@link HermesDashboardResourceDefinition.order}.
 */
export const hermesDashboardRouteMounts = buildHermesDashboardRouteMounts(
  hermesDashboardResources,
);

/**
 * Builds the `HermesDashboardResource` object from registered definitions (throws on duplicate `resourceKey`).
 *
 * @param resources - Registered resource definitions.
 */
export function buildHermesDashboardResourceConst<
  const T extends readonly HermesDashboardResourceDefinition<string, string>[],
>(
  resources: T,
): {
  [K in T[number]["resourceKey"]]: Extract<
    T[number],
    { resourceKey: K }
  >["pathSegment"];
} {
  const out: Record<string, string> = {};
  for (const resource of resources) {
    if (Object.prototype.hasOwnProperty.call(out, resource.resourceKey)) {
      throw new Error(
        `Duplicate Hermes dashboard resourceKey: ${resource.resourceKey}`,
      );
    }
    out[resource.resourceKey] = resource.pathSegment;
  }
  return out as {
    [K in T[number]["resourceKey"]]: Extract<
      T[number],
      { resourceKey: K }
    >["pathSegment"];
  };
}

/**
 * Returns manifest pages sorted by registration `order`.
 *
 * @param resources - Registered resource definitions.
 */
export function buildDashboardManifestPages(
  resources: readonly HermesDashboardResourceDefinition<string, string>[],
): DashboardPageInput[] {
  return [...resources]
    .sort((a, b) => a.order - b.order)
    .map((r) => r.dashboardPage);
}

/**
 * Returns Hono route mounts sorted by registration `order`.
 *
 * @param resources - Registered resource definitions.
 */
export function buildHermesDashboardRouteMounts<
  const T extends readonly HermesDashboardResourceDefinition<string, string>[],
>(
  resources: T,
): ReadonlyArray<{ segment: T[number]["pathSegment"]; app: Hono }> {
  return [...resources]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ segment: r.pathSegment, app: r.routes }));
}
