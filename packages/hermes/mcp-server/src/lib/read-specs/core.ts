import { z } from "zod";

import type { HermesReadToolSpec } from "../read-tool-spec.js";

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
];
