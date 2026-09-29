import { z } from "zod";

import type { HermesHttpMethod } from "./http-client.js";

export type HermesReadToolSpec = {
  name: string;
  title: string;
  description: string;
  method: HermesHttpMethod;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  queryKeys?: readonly string[];
  filtersArgument?: string;
  sortFields?: readonly string[];
  paginated?: boolean;
};

type SortFields = readonly [string, ...string[]];

type ListQueryOptions = {
  searchHint: string;
  sortFields?: SortFields;
  defaultSort?: string;
};

export const MAX_LIST_PAGE_SIZE = 100;

export const LIST_QUERY_KEYS = [
  "page",
  "pageSize",
  "q",
  "sort",
  "dir",
] as const;

const listQueryShape = ({
  searchHint,
  sortFields,
  defaultSort,
}: ListQueryOptions): z.ZodRawShape => {
  const sortDescription = defaultSort
    ? `Sort field. Default: ${defaultSort}.`
    : "Sort field.";
  const sort = sortFields
    ? z.enum(sortFields).optional().describe(sortDescription)
    : z
        .string()
        .min(1)
        .optional()
        .describe(
          "Sort field. Must be one of the view's sortableFields from hermes_list_domain_views.",
        );

  return {
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("1-based page number. Default 1."),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_PAGE_SIZE)
      .optional()
      .describe(`Rows per page, 1 to ${MAX_LIST_PAGE_SIZE}. Default 20.`),
    q: z
      .string()
      .max(200)
      .optional()
      .describe(`Case-insensitive search on ${searchHint}.`),
    sort,
    dir: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
  };
};

const listToolSpec = (
  spec: Omit<
    HermesReadToolSpec,
    "method" | "inputSchema" | "queryKeys" | "sortFields" | "paginated"
  > &
    ListQueryOptions & { sortFields: SortFields },
): HermesReadToolSpec => ({
  name: spec.name,
  title: spec.title,
  description: spec.description,
  method: "GET",
  pathTemplate: spec.pathTemplate,
  inputSchema: listQueryShape(spec),
  queryKeys: LIST_QUERY_KEYS,
  sortFields: spec.sortFields,
  paginated: true,
});

const guidField = (description: string) => z.guid().describe(description);

const nonEmptyStringField = (description: string) =>
  z.string().min(1).describe(description);

export const HERMES_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  {
    name: "hermes_ping",
    title: "Check API key",
    description:
      "Verify the active profile's API key. Returns the key label, readOnly flag, and owning user.",
    method: "GET",
    pathTemplate: "/api/mcp/whoami",
    inputSchema: {},
  },
  {
    name: "hermes_search",
    title: "Search Hermes",
    description:
      "Find pipelines, schedules, HTTP triggers, agents, agent configs, and variables by name, up to 5 of each. Use it to turn a name into an id.",
    method: "GET",
    pathTemplate: "/api/dashboard-search",
    inputSchema: {
      q: z
        .string()
        .min(2)
        .max(100)
        .describe("Search text, 2 to 100 characters."),
    },
    queryKeys: ["q"],
  },
  listToolSpec({
    name: "hermes_list_agents",
    title: "List agents",
    description:
      "Page through registered agents, including their endpoint and JSON schemas.",
    pathTemplate: "/api/agents",
    searchHint: "agent id and description",
    sortFields: ["agentId", "agentVersion", "created", "updated"],
    defaultSort: "agentId asc",
  }),
  {
    name: "hermes_get_agent_schemas",
    title: "Get agent schemas",
    description: "Input and config JSON schemas for one agent version.",
    method: "GET",
    pathTemplate: "/api/agents/{agentId}/{agentVersion}/schemas",
    inputSchema: {
      agentId: nonEmptyStringField("Agent id"),
      agentVersion: nonEmptyStringField("Agent version"),
    },
  },
  listToolSpec({
    name: "hermes_list_agent_configs",
    title: "List agent configs",
    description: "Page through saved agent configs with their config JSON.",
    pathTemplate: "/api/agent-configs",
    searchHint: "config name, description, and agent id",
    sortFields: ["name", "createdAt", "agentId"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_agent_config",
    title: "Get agent config",
    description: "One saved agent config by id.",
    method: "POST",
    pathTemplate: "/dashboard/agent-configs/actions/get",
    inputSchema: { id: guidField("Agent config id") },
  },
  listToolSpec({
    name: "hermes_list_pipelines",
    title: "List pipelines",
    description:
      "Page through pipeline summaries (id, name, description, isActive, stepCount, updatedAt). Use hermes_get_pipeline for steps.",
    pathTemplate: "/api/pipelines",
    searchHint: "pipeline name and description",
    sortFields: ["name", "updated"],
    defaultSort: "updated desc",
  }),
  {
    name: "hermes_get_pipeline",
    title: "Get pipeline",
    description:
      "One pipeline with its ordered steps. An agent step has its agent, input, and config. A pipeline step (kind pipeline) has targetPipelineId and input overrides merged into every step of that pipeline at run time.",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}",
    inputSchema: { pipelineId: guidField("Pipeline id") },
  },
  {
    name: "hermes_get_pipeline_schemas",
    title: "Get pipeline step schemas",
    description:
      "Input and config JSON schemas of the agent behind each agent step. Pipeline steps return kind pipeline, their targetPipelineId, and null schemas.",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/schemas",
    inputSchema: { pipelineId: guidField("Pipeline id") },
  },
  {
    name: "hermes_get_pipeline_execution",
    title: "Get manual pipeline run",
    description:
      "One manual pipeline execution with its step executions and invocations. Secrets are masked.",
    method: "GET",
    pathTemplate: "/api/pipelines/{pipelineId}/executions/{executionId}",
    inputSchema: {
      pipelineId: guidField("Pipeline id"),
      executionId: guidField("Manual pipeline execution id"),
    },
  },
  listToolSpec({
    name: "hermes_list_schedules",
    title: "List schedules",
    description: "Page through schedules with the pipeline each one runs.",
    pathTemplate: "/api/schedules",
    searchHint: "schedule name and description",
    sortFields: ["name", "nextRunAt", "created", "enabled"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_schedule_execution",
    title: "Get schedule execution",
    description:
      "One schedule execution with its step executions and invocations. Secrets are masked.",
    method: "GET",
    pathTemplate: "/api/schedules/{scheduleId}/executions/{executionId}",
    inputSchema: {
      scheduleId: guidField("Schedule id"),
      executionId: guidField("Schedule execution id"),
    },
  },
  listToolSpec({
    name: "hermes_list_http_triggers",
    title: "List HTTP triggers",
    description: "Page through HTTP triggers with the pipeline each one runs.",
    pathTemplate: "/api/http-triggers",
    searchHint: "trigger name and description",
    sortFields: ["name", "created", "enabled", "method"],
    defaultSort: "name asc",
  }),
  {
    name: "hermes_get_http_trigger_execution",
    title: "Get HTTP trigger execution",
    description:
      "One HTTP trigger execution with its step executions and invocations. Secrets are masked.",
    method: "GET",
    pathTemplate: "/api/http-triggers/{triggerId}/executions/{executionId}",
    inputSchema: {
      triggerId: guidField("HTTP trigger id"),
      executionId: guidField("HTTP trigger execution id"),
    },
  },
  listToolSpec({
    name: "hermes_list_variables",
    title: "List variables",
    description:
      "Page through orchestration variables. Secret values are masked.",
    pathTemplate: "/api/variables",
    searchHint: "variable key",
    sortFields: ["key", "created"],
    defaultSort: "key asc",
  }),
  {
    name: "hermes_get_variable",
    title: "Get variable",
    description: "One variable by id. Secret values are masked.",
    method: "POST",
    pathTemplate: "/dashboard/variables/actions/get",
    inputSchema: { id: guidField("Variable id") },
  },
  listToolSpec({
    name: "hermes_list_domain_integrations",
    title: "List domain integrations",
    description:
      "Page through registered domain integrations of every status. No API keys are returned.",
    pathTemplate: "/api/domain-integrations",
    searchHint: "integration id and name",
    sortFields: ["isDefault", "integrationId", "name", "status"],
    defaultSort: "isDefault desc",
  }),
  {
    name: "hermes_list_domain_views",
    title: "List domain views",
    description:
      "Resource-table views of one domain integration, with columns, searchable and sortable fields, and filter query keys. Call it before hermes_list_domain_rows.",
    method: "GET",
    pathTemplate: "/api/domain-integrations/{integrationId}/views",
    inputSchema: {
      integrationId: nonEmptyStringField("Domain integration id"),
    },
  },
  {
    name: "hermes_list_domain_rows",
    title: "List domain rows",
    description:
      "Page through the rows of one domain resource-table view. Use the view's sortableFields for sort and its filter queryKeys for filters.",
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

const PATH_PARAMETER_PATTERN = /\{([^}]+)\}/g;

export const pathTemplateParameterNames = (pathTemplate: string): string[] =>
  [...pathTemplate.matchAll(PATH_PARAMETER_PATTERN)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

export const resolvePathTemplate = (
  pathTemplate: string,
  args: Record<string, unknown>,
): string =>
  pathTemplate.replace(PATH_PARAMETER_PATTERN, (_match, key: string) => {
    const value = args[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`);
    }

    return encodeURIComponent(String(value));
  });

const isQueryValue = (value: unknown): value is string | number =>
  typeof value === "string" || typeof value === "number";

export const buildSearchParamsForSpec = (
  spec: HermesReadToolSpec,
  args: Record<string, unknown>,
): Record<string, string | number> | undefined => {
  const searchParams: Record<string, string | number> = {};
  const filters =
    spec.filtersArgument === undefined ? undefined : args[spec.filtersArgument];
  if (typeof filters === "object" && filters !== null) {
    for (const [key, value] of Object.entries(filters)) {
      if (isQueryValue(value)) {
        searchParams[key] = value;
      }
    }
  }
  for (const key of spec.queryKeys ?? []) {
    const value = args[key];
    if (isQueryValue(value)) {
      searchParams[key] = value;
    }
  }

  return Object.keys(searchParams).length > 0 ? searchParams : undefined;
};

export const buildRequestBodyForSpec = (
  spec: HermesReadToolSpec,
  args: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (spec.method !== "POST") {
    return undefined;
  }

  const consumedKeys = new Set<string>([
    ...pathTemplateParameterNames(spec.pathTemplate),
    ...(spec.queryKeys ?? []),
  ]);

  return Object.fromEntries(
    Object.entries(args).filter(([key]) => !consumedKeys.has(key)),
  );
};
