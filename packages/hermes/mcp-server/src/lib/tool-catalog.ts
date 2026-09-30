import { AGENT_READ_TOOL_SPECS } from "./read-specs/agents.js";
import { CORE_READ_TOOL_SPECS } from "./read-specs/core.js";
import { DOMAIN_READ_TOOL_SPECS } from "./read-specs/domain.js";
import { HTTP_TRIGGER_READ_TOOL_SPECS } from "./read-specs/http-triggers.js";
import { PIPELINE_READ_TOOL_SPECS } from "./read-specs/pipelines.js";
import { SCHEDULE_READ_TOOL_SPECS } from "./read-specs/schedules.js";
import { VARIABLE_READ_TOOL_SPECS } from "./read-specs/variables.js";
import type { HermesReadToolSpec } from "./read-tool-spec.js";

export {
  LIST_QUERY_KEYS,
  MAX_LIST_PAGE_SIZE,
  type HermesReadToolSpec,
} from "./read-tool-spec.js";

export const HERMES_READ_TOOL_SPECS: HermesReadToolSpec[] = [
  ...CORE_READ_TOOL_SPECS,
  ...AGENT_READ_TOOL_SPECS,
  ...PIPELINE_READ_TOOL_SPECS,
  ...SCHEDULE_READ_TOOL_SPECS,
  ...HTTP_TRIGGER_READ_TOOL_SPECS,
  ...VARIABLE_READ_TOOL_SPECS,
  ...DOMAIN_READ_TOOL_SPECS,
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
