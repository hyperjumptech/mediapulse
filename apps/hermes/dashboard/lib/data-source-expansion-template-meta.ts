/**
 * Static table-v1 metadata and synthetic manifest page for Hermes-stored data source expansion templates.
 */

import {
  dashboardPageSchema,
  tableV1MetaResponseSchema,
  type DashboardPage,
} from "@hermes/domain-contract";

import {
  dataSourceExpansionTemplateCreateFormJsonSchema,
  dataSourceExpansionTemplateUpdateFormJsonSchema,
} from "./data-source-expansion-template-write-schemas";

/** Path segment under `/dashboard/{integrationId}/…`. */
export const DATA_SOURCE_EXPANSIONS_PATH_SEGMENT = "data-source-expansions";

export const hermesDataSourceExpansionsManifestApiPrefix = (): string =>
  `/v1/hermes-dashboard/${DATA_SOURCE_EXPANSIONS_PATH_SEGMENT}`;

/**
 * Returns validated table-v1 meta for the expansion templates resource (no domain HTTP call).
 *
 * @returns Parsed meta payload for list/create/edit UI.
 */
export const getDataSourceExpansionTemplateTableMeta = () =>
  tableV1MetaResponseSchema.parse({
    title: "Data source expansions",
    description:
      "Manage reusable db: expansion aliases used in pipeline inputs. Templates are stored in Hermes; preview runs against the domain integration database.",
    columns: [
      { key: "name", label: "Name", type: "text" },
      { key: "expansionString", label: "Expansion string", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "createdAt", label: "Created", type: "date-time" },
    ],
    searchableFields: ["name", "description", "expansionString"],
    sortableFields: ["name", "createdAt"],
    actions: { create: true, update: true, delete: true },
    createSchema: dataSourceExpansionTemplateCreateFormJsonSchema,
    updateSchema: dataSourceExpansionTemplateUpdateFormJsonSchema,
    customActions: [],
    createNavigation: "full-page",
    preview: { enabled: true, fieldKey: "expansionString" },
  });

/**
 * Synthetic manifest page for sidebar navigation when the domain no longer advertises this resource.
 *
 * @returns Validated dashboard page for merging into integration nav.
 */
export const buildSyntheticDataSourceExpansionsDashboardPage =
  (): DashboardPage =>
    dashboardPageSchema.parse({
      id: DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
      label: "Data source expansions",
      description:
        "Manage reusable db: expansion aliases used in pipeline inputs.",
      pathSegment: DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
      template: "table-v1",
      apiPrefix: hermesDataSourceExpansionsManifestApiPrefix(),
      order: 50,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "expansionString", label: "Expansion string", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description", "expansionString"],
      sortableFields: ["name", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createSchema: dataSourceExpansionTemplateCreateFormJsonSchema,
      updateSchema: dataSourceExpansionTemplateUpdateFormJsonSchema,
      customActions: [],
      createNavigation: "full-page",
      preview: { enabled: true, fieldKey: "expansionString" },
    });
