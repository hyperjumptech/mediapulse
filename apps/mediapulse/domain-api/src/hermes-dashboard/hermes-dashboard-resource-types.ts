import type { DashboardPageInput } from "@hermes/domain-contract";
import type { Hono } from "hono";

/**
 * One Hermes dashboard-integrated resource: HTTP routes plus the manifest page shown in Hermes.
 *
 * @typeParam K - Stable camelCase key used for the `HermesDashboardResource` segment map.
 * @typeParam S - URL path segment (kebab-case) under `/v1/hermes-dashboard/`.
 */
export type HermesDashboardResourceDefinition<
  K extends string = string,
  S extends string = string,
> = {
  /** Stable camelCase key used for the `HermesDashboardResource` segment map. */
  readonly resourceKey: K;
  /** URL path segment (kebab-case) under `/v1/hermes-dashboard/`. */
  readonly pathSegment: S;
  /** Sort key for manifest `pages` order (must match {@link DashboardPageInput.order} on `dashboardPage`). */
  readonly order: number;
  /** Hono sub-app mounted at `/v1/hermes-dashboard/<segment>/` (list, CRUD, resource-specific routes). */
  readonly routes: Hono;
  /** Hermes manifest page for `table-v1` (columns, search/sort fields, form JSON Schema, actions). */
  readonly dashboardPage: DashboardPageInput;
};

/**
 * Normalizes a Hermes dashboard resource definition (single constructor for resource modules).
 *
 * @param definition - Resource key, path segment, sort order, Hono app, and manifest page.
 * @returns The same object (identity), for use with `as const` inference at call sites.
 */
export const defineHermesDashboardResource = <
  const K extends string,
  const S extends string,
>(
  definition: HermesDashboardResourceDefinition<K, S>,
): HermesDashboardResourceDefinition<K, S> => definition;
