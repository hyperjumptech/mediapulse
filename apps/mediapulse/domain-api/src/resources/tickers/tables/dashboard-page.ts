import type { DashboardPageInput } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "../../../hermes-dashboard/paths";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import { tickerMetadataFormProperties } from "./metadata-form-properties";
import type { ListItem } from "../hermes-dashboard/templates/table-v1/list-mapper";

/** Hermes `table-v1` manifest page for the tickers resource. */
export const tickersDashboardPage = {
  id: HermesDashboardResource.tickers,
  label: "Tickers",
  description: "Manage ticker symbols and company names for data sources.",
  pathSegment: HermesDashboardResource.tickers,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(HermesDashboardResource.tickers),
  order: 10,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["symbol", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["symbol", "name", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: {
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
  },
  updateSchema: {
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
  },
  customActions: [
    {
      id: "import-idx-json",
      label: "Import IDX JSON",
      description:
        "Upload a JSON file in IDX company profiles format (object with a data array).",
      ui: "json-file-upload" as const,
      method: "POST" as const,
      path: "/import-idx-json",
      accept: ".json,application/json",
    },
  ],
} satisfies DashboardPageInput;
