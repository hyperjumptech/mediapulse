import { z } from "zod";

import {
  LIST_QUERY_KEYS,
  listQueryShape,
  listToolSpec,
  nonEmptyStringField,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const DOMAIN_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_domain_integrations",
    title: "List domain integrations",
    description:
      "Page through registered domain integrations of every status. No API keys are returned.",
    toolset: "domain",
    pathTemplate: "/api/domain-integrations",
    searchHint: "integration id and name",
    sortFields: ["isDefault", "integrationId", "name", "status"],
    defaultSort: "isDefault desc",
  }),
  {
    name: "hermes_list_domain_views",
    title: "List domain views",
    description:
      "Views of one domain integration. Resource-table views list columns, search and sort fields, filter query keys, which row actions are allowed, and custom actions. contentViews lists markdown, html, and text views. Call it before hermes_list_domain_rows.",
    toolset: "domain",
    method: "GET",
    pathTemplate: "/api/domain-integrations/{integrationId}/views",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
    },
  },
  {
    name: "hermes_get_domain_view",
    title: "Get domain view",
    description:
      "Live metadata of one resource-table view: create and update JSON schemas, allowed actions, custom actions, filters with their options, and detail blocks. Read it before creating or updating a row.",
    toolset: "domain",
    method: "GET",
    pathTemplate: "/api/domain-integrations/{integrationId}/{resource}/meta",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
      resource: nonEmptyStringField(
        "View pathSegment from hermes_list_domain_views",
      ),
    },
  },
  {
    name: "hermes_get_domain_content",
    title: "Get domain content view",
    description:
      "Rendered body of a markdown, html, or text view from hermes_list_domain_views contentViews or an agent's agentTabViews.",
    toolset: "domain",
    method: "GET",
    pathTemplate:
      "/api/domain-integrations/{integrationId}/views/{viewId}/content",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
      viewId: nonEmptyStringField("Content view id"),
      agentId: z
        .string()
        .min(1)
        .optional()
        .describe("Agent id, for agent-tab views"),
    },
    queryKeys: ["agentId"],
  },
  {
    name: "hermes_list_domain_rows",
    title: "List domain rows",
    description:
      "Page through the rows of one domain resource-table view. Use the view's sortableFields for sort and its filter queryKeys for filters.",
    toolset: "domain",
    method: "GET",
    pathTemplate: "/api/domain-integrations/{integrationId}/{resource}",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
      resource: nonEmptyStringField(
        "View pathSegment from hermes_list_domain_views",
      ),
      ...listQueryShape({ searchHint: "the view's searchableFields" }),
      filters: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Filter values keyed by the view's filter queryKeys. Unknown keys are ignored.",
        ),
    },
    queryKeys: LIST_QUERY_KEYS,
    filtersArgument: "filters",
    paginated: true,
  },
  {
    name: "hermes_get_domain_row",
    title: "Get domain row",
    description: "One row of a domain resource-table view by id.",
    toolset: "domain",
    method: "GET",
    pathTemplate:
      "/api/domain-integrations/{integrationId}/{resource}/{itemId}",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
      resource: nonEmptyStringField(
        "View pathSegment from hermes_list_domain_views",
      ),
      itemId: nonEmptyStringField("Row id"),
    },
  },
];
