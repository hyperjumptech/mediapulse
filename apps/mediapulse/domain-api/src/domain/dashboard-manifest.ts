import { dashboardManifestSchema } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "./hermes-dashboard-paths";
import { tickerMetadataFormProperties } from "./ticker-metadata-form-properties";

/**
 * Hermes domain-dashboard manifest for Mediapulse, validated at load time against the domain contract schema.
 */
export const dashboardManifest = dashboardManifestSchema.parse({
  templateVersion: 1,
  pages: [
    {
      id: HermesDashboardResource.tickers,
      label: "Tickers",
      description: "Manage ticker symbols and company names for data sources.",
      pathSegment: HermesDashboardResource.tickers,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.tickers,
      ),
      order: 10,
      columns: [
        { key: "symbol", label: "Symbol", type: "text" },
        { key: "name", label: "Name", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["symbol", "name"],
      sortableFields: ["symbol", "name", "createdAt"],
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
          ui: "json-file-upload",
          method: "POST",
          path: "/import-idx-json",
          accept: ".json,application/json",
        },
      ],
    },
    {
      id: HermesDashboardResource.mediapulseUsers,
      label: "Mediapulse users",
      description:
        "End users and newsletter subscribers (distinct from Hermes dashboard admins).",
      pathSegment: HermesDashboardResource.mediapulseUsers,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.mediapulseUsers,
      ),
      order: 15,
      columns: [
        { key: "email", label: "Email", type: "text" },
        { key: "name", label: "Name", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["email", "name"],
      sortableFields: ["email", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createSchema: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", title: "Email", format: "email" },
          name: { type: "string", title: "Name" },
        },
      },
      updateSchema: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", title: "Email", format: "email" },
          name: { type: "string", title: "Name" },
        },
      },
    },
    {
      id: HermesDashboardResource.entityTypes,
      label: "Entity Types",
      description:
        "Manage vocabulary used by the knowledge graph entity classifier.",
      pathSegment: HermesDashboardResource.entityTypes,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.entityTypes,
      ),
      order: 20,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description"],
      sortableFields: ["name", "createdAt"],
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
    },
    {
      id: HermesDashboardResource.relationTypes,
      label: "Relation Types",
      description:
        "Manage vocabulary used by the knowledge graph relation classifier.",
      pathSegment: HermesDashboardResource.relationTypes,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.relationTypes,
      ),
      order: 30,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description"],
      sortableFields: ["name", "createdAt"],
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
    },
    {
      id: HermesDashboardResource.searchQueries,
      label: "Search Query",
      description: "Manage generated search queries and remove unused rows.",
      pathSegment: HermesDashboardResource.searchQueries,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.searchQueries,
      ),
      order: 40,
      columns: [
        { key: "tickerSymbol", label: "Ticker", type: "text" },
        { key: "tickerName", label: "Ticker Name", type: "text" },
        { key: "text", label: "Search Query", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["tickerName", "tickerSymbol", "text"],
      sortableFields: ["createdAt"],
      actions: { create: false, update: false, delete: true },
    },
    {
      id: HermesDashboardResource.dataSourceExpansions,
      label: "Data source expansions",
      description:
        "Manage reusable db: expansion aliases used in pipeline inputs.",
      pathSegment: HermesDashboardResource.dataSourceExpansions,
      template: "table-v1",
      apiPrefix: hermesDashboardManifestApiPrefix(
        HermesDashboardResource.dataSourceExpansions,
      ),
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
      createNavigation: "full-page",
      preview: { enabled: true, fieldKey: "expansionString" },
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
    },
  ],
});
