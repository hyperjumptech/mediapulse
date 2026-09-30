import { z } from "zod";

import { guidField, type HermesReadToolSpec } from "../read-tool-spec.js";

export const CORE_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  {
    name: "hermes_ping",
    title: "Check API key",
    description:
      "Verify the active profile's API key. Returns the key label, readOnly flag, and owning user.",
    toolset: "core",
    method: "GET",
    pathTemplate: "/api/mcp/whoami",
    inputSchema: {},
  },
  {
    name: "hermes_search",
    title: "Search Hermes",
    description:
      "Find pipelines, schedules, HTTP triggers, agents, agent configs, and variables by name, up to 5 of each. Use it to turn a name into an id.",
    toolset: "core",
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
  {
    name: "hermes_get_overview",
    title: "Get overview",
    description:
      "The dashboard overview: run counts for the last and previous 24 hours, running and recently failed executions, upcoming schedules, and a daily series of runs and failures.",
    toolset: "core",
    method: "GET",
    pathTemplate: "/api/overview",
    inputSchema: {
      days: z
        .number()
        .int()
        .min(1)
        .max(90)
        .optional()
        .describe("Days in the daily series, 1 to 90. Default 30."),
      timeZone: z
        .string()
        .min(1)
        .optional()
        .describe(
          "IANA time zone the daily series is bucketed in. Default UTC.",
        ),
    },
    queryKeys: ["days", "timeZone"],
  },
  {
    name: "hermes_get_invocation",
    title: "Get invocation payload",
    description:
      "The input, config, transport error, and agent response of one invocation in an execution, with secrets masked. Take jobId from the execution's invocations.",
    toolset: "core",
    method: "POST",
    pathTemplate: "/dashboard/executions/actions/get-invocation",
    inputSchema: {
      kind: z
        .enum(["schedule", "httpTrigger", "manual"])
        .describe("What started the execution"),
      parentId: guidField(
        "Schedule id, HTTP trigger id, or pipeline id (manual runs)",
      ),
      executionId: guidField("Execution id"),
      jobId: z.string().min(1).describe("Invocation job id"),
    },
  },
  {
    name: "hermes_get_agent_activities",
    title: "Get agent activities",
    description:
      "The progress steps an agent reported while handling one invocation, oldest first.",
    toolset: "core",
    method: "POST",
    pathTemplate: "/dashboard/executions/actions/get-agent-activities",
    inputSchema: {
      jobId: z.string().min(1).describe("Invocation job id"),
    },
  },
];
