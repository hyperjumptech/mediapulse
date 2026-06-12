import type { HermesDashboardExtensions } from "./types";

let cached: HermesDashboardExtensions | null | undefined;

/**
 * Loads optional dashboard extensions from `HERMES_DASHBOARD_EXTENSIONS` (npm package subpath).
 * Returns null when unset so Hermes ships without product-domain UI.
 *
 * @returns Registered extensions or null.
 */
export const loadHermesDashboardExtensions =
  async (): Promise<HermesDashboardExtensions | null> => {
    if (cached !== undefined) {
      return cached;
    }

    const moduleId = process.env.HERMES_DASHBOARD_EXTENSIONS?.trim();
    if (!moduleId) {
      cached = null;
      return null;
    }

    const mod = (await import(moduleId)) as {
      hermesDashboardExtensions?: HermesDashboardExtensions;
      default?: HermesDashboardExtensions;
    };
    const extensions = mod.hermesDashboardExtensions ?? mod.default ?? null;
    cached = extensions;
    return extensions;
  };

/**
 * Clears the in-memory extension cache (for tests).
 */
export const resetHermesDashboardExtensionsCache = (): void => {
  cached = undefined;
};
