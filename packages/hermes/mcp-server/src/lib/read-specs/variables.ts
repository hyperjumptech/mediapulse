import {
  guidField,
  listToolSpec,
  type HermesReadToolSpec,
} from "../read-tool-spec.js";

export const VARIABLE_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  listToolSpec({
    name: "hermes_list_variables",
    title: "List variables",
    description:
      "Page through orchestration variables. Secret values are masked.",
    toolset: "variables",
    pathTemplate: "/api/variables",
    searchHint: "variable key",
    sortFields: ["key", "created"],
    defaultSort: "key asc",
  }),
  {
    name: "hermes_get_variable",
    title: "Get variable",
    description: "One variable by id. Secret values are masked.",
    toolset: "variables",
    method: "POST",
    pathTemplate: "/dashboard/variables/actions/get",
    inputSchema: { id: guidField("Variable id") },
  },
];
