import type {
  DashboardViewInput,
  DetailBlock,
  TableV1ListFilterDefinition,
} from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { publisherNameSourceLabels } from "./name-source-labels";
import { publisherUpdateFormJsonSchema } from "./write-body-schemas";

export const publishersHermesPathSegment = "publishers" as const;

export const publisherNameSourceSelectListFilter = {
  key: "nameSource",
  label: "Name source",
  ui: "select",
  placeholderAll: "All sources",
  staticOptions: Object.entries(publisherNameSourceLabels).map(
    ([value, label]) => ({ value, label }),
  ),
} satisfies TableV1ListFilterDefinition;

const publisherDetailsBlock = {
  type: "keyValue",
  rows: [
    { field: "domain", label: "Domain", linkTemplate: "https://{domain}" },
    { field: "nameSourceLabel", label: "Name source" },
    { field: "lastSeenAt", label: "Last seen", format: "date-time" },
  ],
} satisfies DetailBlock;

export const publishersDashboardPage = {
  id: publishersHermesPathSegment,
  label: "Publishers",
  description:
    "Publisher names shown in newsletter bylines, one per registrable domain. Saving a name marks it Manual, and no agent overwrites a Manual name.",
  pathSegment: publishersHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(publishersHermesPathSegment),
  order: 36,
  columns: columnsFor<ListItem>()([
    { key: "displayName", label: "Name", type: "text" },
    { key: "domain", label: "Domain", type: "text", mobile: "subtitle" },
    {
      key: "nameSourceLabel",
      label: "Name source",
      type: "text",
      mobile: "hidden",
    },
    {
      key: "lastSeenAt",
      label: "Last seen",
      type: "date-time",
      format: "date-time",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["displayName", "domain"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "displayName",
    "domain",
    "lastSeenAt",
  ]),
  defaultSort: { sortBy: "lastSeenAt", sortDir: "desc" as const },
  listFilters: [publisherNameSourceSelectListFilter],
  actions: { create: false, update: true, delete: false, view: true },
  updateSchema: publisherUpdateFormJsonSchema,
  detailBlocks: [publisherDetailsBlock],
} satisfies DashboardViewInput;
