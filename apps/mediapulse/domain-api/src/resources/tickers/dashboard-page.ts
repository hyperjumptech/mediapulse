/**
 * Hermes `table-v1` manifest for tickers (custom actions, metadata form) and exported path segment.
 */

import {
  dashboardObjectFormJsonSchemaForListRow,
  type DashboardPageInput,
} from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import { tickerMetadataFormProperties } from "./metadata-form-properties";
import type { ListItem } from "./list-mapper";
import { tickersCustomActionsForManifest } from "./tickers-table-v1-custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const tickersHermesPathSegment = "tickers" as const;

/** Hermes `table-v1` manifest page for the tickers resource. */
export const tickersDashboardPage = {
  id: tickersHermesPathSegment,
  label: "Tickers",
  description: "Manage ticker symbols and company names for data sources.",
  pathSegment: tickersHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(tickersHermesPathSegment),
  order: 10,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["symbol", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["symbol", "name", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["symbol", "name"],
    properties: {
      symbol: { type: "string", title: "Symbol" },
      name: { type: "string", title: "Name" },
      metadata: {
        type: "object",
        title: "Metadata",
        nullable: true,
        properties: tickerMetadataFormProperties,
      },
    },
  }),
  updateSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["symbol", "name"],
    properties: {
      symbol: { type: "string", title: "Symbol" },
      name: { type: "string", title: "Name" },
      metadata: {
        type: "object",
        title: "Metadata",
        nullable: true,
        properties: tickerMetadataFormProperties,
      },
    },
  }),
  customActions: tickersCustomActionsForManifest,
} satisfies DashboardPageInput;
