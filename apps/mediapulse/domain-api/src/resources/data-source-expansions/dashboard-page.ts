import type { DashboardPageInput } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "../../hermes-dashboard/paths";
import {
  columnsFor,
  previewFieldFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** Hermes `table-v1` manifest page for data-source expansions. */
export const dataSourceExpansionsDashboardPage = {
  id: HermesDashboardResource.dataSourceExpansions,
  label: "Data source expansions",
  description: "Manage reusable db: expansion aliases used in pipeline inputs.",
  pathSegment: HermesDashboardResource.dataSourceExpansions,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    HermesDashboardResource.dataSourceExpansions,
  ),
  order: 50,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "expansionString", label: "Expansion string", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "name",
    "description",
    "expansionString",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["name", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createNavigation: "full-page" as const,
  preview: previewFieldFor<ListItem>()("expansionString"),
  createSchema: {
    type: "object",
    required: ["name", "expansionString"],
    properties: {
      name: { type: "string", title: "Name" },
      expansionString: { type: "string", title: "Expansion string" },
      description: { type: "string", title: "Description" },
    },
  },
  updateSchema: {
    type: "object",
    required: ["name", "expansionString"],
    properties: {
      name: { type: "string", title: "Name" },
      expansionString: { type: "string", title: "Expansion string" },
      description: { type: "string", title: "Description" },
    },
  },
} satisfies DashboardPageInput;
