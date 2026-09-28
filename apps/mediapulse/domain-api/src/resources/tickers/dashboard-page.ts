import { type DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { tickersCustomActionsForManifest } from "./custom-actions";
import {
  tickerCreateFormJsonSchema,
  tickerUpdateFormJsonSchema,
} from "./write-body-schemas";

export const tickersHermesPathSegment = "tickers" as const;

export const tickersDashboardPage = {
  id: tickersHermesPathSegment,
  label: "Tickers",
  description:
    "Ticker symbols and company names; admin-created or imported via IDX JSON.",
  pathSegment: tickersHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(tickersHermesPathSegment),
  order: 10,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text", mobile: "subtitle" },
    {
      key: "createdAt",
      label: "Created",
      type: "date-time",
      format: "date-time",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["symbol", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["symbol", "name", "createdAt"]),
  actions: { create: true, update: true, delete: true, view: false },
  createSchema: tickerCreateFormJsonSchema,
  updateSchema: tickerUpdateFormJsonSchema,
  customActions: tickersCustomActionsForManifest,
} satisfies DashboardViewInput;
