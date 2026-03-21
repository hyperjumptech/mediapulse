import type { DashboardPageInput } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "../../../hermes-dashboard/paths";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "../hermes-dashboard/templates/table-v1/list-mapper";

/** Hermes `table-v1` manifest page for entity types. */
export const entityTypesDashboardPage = {
  id: HermesDashboardResource.entityTypes,
  label: "Entity Types",
  description:
    "Manage vocabulary used by the knowledge graph entity classifier.",
  pathSegment: HermesDashboardResource.entityTypes,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    HermesDashboardResource.entityTypes,
  ),
  order: 20,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name", "description"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["name", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", title: "Name" },
      description: { type: "string", title: "Description" },
    },
  },
  updateSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", title: "Name" },
      description: { type: "string", title: "Description" },
    },
  },
} satisfies DashboardPageInput;
