import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const newslettersHermesPathSegment = "newsletters" as const;

/** Hermes `table-v1` manifest for the read-only newsletters list. */
export const newslettersDashboardPage = {
  id: newslettersHermesPathSegment,
  label: "Newsletters",
  description:
    "Generated newsletters with delivery counts: who got it, how many, and which ticker.",
  pathSegment: newslettersHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(newslettersHermesPathSegment),
  order: 60,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
    { key: "deliveryDelivered", label: "Delivery", type: "text" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["subject"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt", "subject"]),
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardPageInput;
