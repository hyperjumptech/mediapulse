import { AGENT_MUTATE_TOOL_SPECS } from "./mutate-specs/agents.js";
import { DOMAIN_MUTATE_TOOL_SPECS } from "./mutate-specs/domain.js";
import { HTTP_TRIGGER_MUTATE_TOOL_SPECS } from "./mutate-specs/http-triggers.js";
import { PIPELINE_MUTATE_TOOL_SPECS } from "./mutate-specs/pipelines.js";
import { SCHEDULE_MUTATE_TOOL_SPECS } from "./mutate-specs/schedules.js";
import { VARIABLE_MUTATE_TOOL_SPECS } from "./mutate-specs/variables.js";
import {
  LOCAL_ONLY_FIELDS,
  type HermesMutateToolSpec,
} from "./mutate-tool-spec.js";

export type { HermesMutateToolSpec } from "./mutate-tool-spec.js";

export const HERMES_MUTATE_TOOL_SPECS: HermesMutateToolSpec[] = [
  ...AGENT_MUTATE_TOOL_SPECS,
  ...VARIABLE_MUTATE_TOOL_SPECS,
  ...PIPELINE_MUTATE_TOOL_SPECS,
  ...SCHEDULE_MUTATE_TOOL_SPECS,
  ...HTTP_TRIGGER_MUTATE_TOOL_SPECS,
  ...DOMAIN_MUTATE_TOOL_SPECS,
];

export const buildMutationRequestBody = (
  args: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).filter(([key]) => !LOCAL_ONLY_FIELDS.includes(key)),
  );
