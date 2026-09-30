import { runtimeProcessEnv } from "./profiles.js";

export const HERMES_TOOLSETS = [
  "core",
  "pipelines",
  "schedules",
  "triggers",
  "agents",
  "variables",
  "domain",
  "admin",
] as const;

export type HermesToolset = (typeof HERMES_TOOLSETS)[number];

export const TOOLSETS_ENV = "HERMES_MCP_TOOLSETS";

const isHermesToolset = (value: string): value is HermesToolset =>
  (HERMES_TOOLSETS as readonly string[]).includes(value);

export const parseEnabledToolsets = (
  rawValue: string | undefined,
): ReadonlySet<HermesToolset> => {
  const requestedToolsets = (rawValue ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(isHermesToolset);
  if (requestedToolsets.length === 0) {
    return new Set(HERMES_TOOLSETS);
  }

  return new Set<HermesToolset>(["core", ...requestedToolsets]);
};

export const loadEnabledToolsets = (
  env: NodeJS.ProcessEnv = runtimeProcessEnv(),
): ReadonlySet<HermesToolset> => parseEnabledToolsets(env[TOOLSETS_ENV]);
