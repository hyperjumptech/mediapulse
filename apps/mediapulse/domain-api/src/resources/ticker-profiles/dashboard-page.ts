import { type DashboardViewInput } from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { tickerProfilesCustomActionsForManifest } from "./custom-actions";

export const tickerProfilesHermesPathSegment = "ticker-profiles" as const;

export const tickerProfilesDashboardPage = {
  id: tickerProfilesHermesPathSegment,
  label: "Ticker Profiles",
  description:
    "Curated issuer profiles: classification in both languages, aliases, competitors and regulators.",
  pathSegment: tickerProfilesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(tickerProfilesHermesPathSegment),
  order: 11,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text", mobile: "subtitle" },
    { key: "sector", label: "Sector", type: "text", hideBelow: "md" },
    {
      key: "subSector",
      label: "Sub-sector",
      type: "text",
      hideBelow: "xl",
      mobile: "hidden",
    },
    {
      key: "industry",
      label: "Industry",
      type: "text",
      hideBelow: "lg",
      mobile: "hidden",
    },
    {
      key: "competitors",
      label: "Competitors",
      type: "text",
      hideBelow: "xl",
      mobile: "hidden",
      defaultHidden: true,
    },
    {
      key: "updatedAt",
      label: "Updated",
      type: "date-time",
      format: "date-time",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "symbol",
    "name",
    "sector",
    "subSector",
    "industry",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "symbol",
    "sector",
    "subSector",
    "industry",
    "updatedAt",
  ]),
  actions: { create: false, update: false, delete: true, view: false },
  customActions: tickerProfilesCustomActionsForManifest,
} satisfies DashboardViewInput;
