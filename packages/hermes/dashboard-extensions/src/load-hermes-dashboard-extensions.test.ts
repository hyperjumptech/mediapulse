/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadHermesDashboardExtensions,
  resetHermesDashboardExtensionsCache,
} from "./load-hermes-dashboard-extensions";

describe("loadHermesDashboardExtensions", () => {
  afterEach(() => {
    resetHermesDashboardExtensionsCache();
    vi.unstubAllEnvs();
  });

  it("returns null when HERMES_DASHBOARD_EXTENSIONS is unset", async () => {
    vi.stubEnv("HERMES_DASHBOARD_EXTENSIONS", "");

    await expect(loadHermesDashboardExtensions()).resolves.toBeNull();
  });
});
