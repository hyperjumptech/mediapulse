/** A named Hermes connection profile (base URL + API key). */
export type HermesMcpProfile = {
  name: string;
  baseUrl: string;
  apiKey: string;
};

const PROFILE_ENV_PREFIX = "HERMES_MCP_PROFILE_";
const PROFILE_BASE_URL_SUFFIX = "_BASE_URL";
const PROFILE_API_KEY_SUFFIX = "_API_KEY";
const ACTIVE_PROFILE_ENV = "HERMES_MCP_ACTIVE_PROFILE";

/** In-process override when the user switches profile via MCP tool. */
let activeProfileOverride: string | undefined;

/**
 * Clears the in-process active profile override (for tests).
 */
export const resetActiveProfileOverride = (): void => {
  activeProfileOverride = undefined;
};

/**
 * Sets the in-process active profile name (used by {@link hermes_set_active_profile}).
 *
 * @param name - Profile name (case-insensitive match against env-defined profiles).
 */
export const setActiveProfileOverride = (name: string): void => {
  activeProfileOverride = name;
};

/**
 * Parses `HERMES_MCP_PROFILE_<NAME>_BASE_URL` and `_API_KEY` from the environment.
 *
 * @param env - Environment map (default: `process.env`).
 * @returns Profiles keyed by normalized uppercase name.
 */
export const loadProfilesFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): Map<string, HermesMcpProfile> => {
  const byName = new Map<string, { baseUrl?: string; apiKey?: string }>();

  for (const [key, value] of Object.entries(env)) {
    if (
      !key.startsWith(PROFILE_ENV_PREFIX) ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    const rest = key.slice(PROFILE_ENV_PREFIX.length);
    if (rest.endsWith(PROFILE_BASE_URL_SUFFIX)) {
      const name = rest.slice(0, -PROFILE_BASE_URL_SUFFIX.length);
      const entry = byName.get(name) ?? {};
      entry.baseUrl = value.replace(/\/$/, "");
      byName.set(name, entry);
      continue;
    }

    if (rest.endsWith(PROFILE_API_KEY_SUFFIX)) {
      const name = rest.slice(0, -PROFILE_API_KEY_SUFFIX.length);
      const entry = byName.get(name) ?? {};
      entry.apiKey = value;
      byName.set(name, entry);
    }
  }

  const profiles = new Map<string, HermesMcpProfile>();
  for (const [name, parts] of byName) {
    if (!parts.baseUrl || !parts.apiKey) {
      continue;
    }
    profiles.set(normalizeProfileName(name), {
      name: normalizeProfileName(name),
      baseUrl: parts.baseUrl,
      apiKey: parts.apiKey,
    });
  }

  return profiles;
};

/**
 * Resolves the active profile name from override, env, or the sole configured profile.
 *
 * @param profiles - Loaded profiles.
 * @param env - Environment map (default: `process.env`).
 * @returns Active profile name or `undefined` when ambiguous / missing.
 */
export const resolveActiveProfileName = (
  profiles: Map<string, HermesMcpProfile>,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  if (activeProfileOverride) {
    const normalized = normalizeProfileName(activeProfileOverride);
    if (profiles.has(normalized)) {
      return normalized;
    }
    return undefined;
  }

  const fromEnv = env[ACTIVE_PROFILE_ENV]?.trim();
  if (fromEnv) {
    const normalized = normalizeProfileName(fromEnv);
    if (profiles.has(normalized)) {
      return normalized;
    }
    return undefined;
  }

  if (profiles.size === 1) {
    return [...profiles.keys()][0];
  }

  return undefined;
};

/**
 * Returns the active Hermes MCP profile, or an error message when none is configured.
 *
 * @param dependencies - Injectable env loader and profile store.
 * @returns Profile or human-readable configuration error (never includes apiKey).
 */
export const getActiveProfile = (
  dependencies: {
    loadProfiles?: typeof loadProfilesFromEnv;
    env?: NodeJS.ProcessEnv;
  } = {},
): { profile: HermesMcpProfile } | { error: string } => {
  const loadProfiles = dependencies.loadProfiles ?? loadProfilesFromEnv;
  const env = dependencies.env ?? process.env;
  const profiles = loadProfiles(env);

  if (profiles.size === 0) {
    return {
      error:
        "No Hermes MCP profiles configured. Set HERMES_MCP_PROFILE_<NAME>_BASE_URL and HERMES_MCP_PROFILE_<NAME>_API_KEY.",
    };
  }

  const activeName = resolveActiveProfileName(profiles, env);
  if (!activeName) {
    const names = [...profiles.keys()].sort().join(", ");
    return {
      error: `Multiple Hermes MCP profiles (${names}). Set HERMES_MCP_ACTIVE_PROFILE or call hermes_set_active_profile.`,
    };
  }

  const profile = profiles.get(activeName);
  if (!profile) {
    return { error: `Active profile "${activeName}" is not configured.` };
  }

  return { profile };
};

/**
 * Lists configured profile names and which one is active (no secrets).
 *
 * @param dependencies - Injectable env loader.
 * @returns Summary safe to return from MCP tools.
 */
export const listProfileSummary = (
  dependencies: {
    loadProfiles?: typeof loadProfilesFromEnv;
    env?: NodeJS.ProcessEnv;
  } = {},
): { profiles: string[]; active: string | null; error?: string } => {
  const loadProfiles = dependencies.loadProfiles ?? loadProfilesFromEnv;
  const env = dependencies.env ?? process.env;
  const profiles = loadProfiles(env);
  const names = [...profiles.keys()].sort();

  if (names.length === 0) {
    return {
      profiles: [],
      active: null,
      error:
        "No Hermes MCP profiles configured. Set HERMES_MCP_PROFILE_<NAME>_BASE_URL and HERMES_MCP_PROFILE_<NAME>_API_KEY.",
    };
  }

  const activeName = resolveActiveProfileName(profiles, env) ?? null;
  return { profiles: names, active: activeName };
};

/**
 * Normalizes a profile name to uppercase for stable lookup.
 *
 * @param name - Raw profile name from env or tool args.
 * @returns Uppercase profile key.
 */
export const normalizeProfileName = (name: string): string =>
  name.trim().toUpperCase();
