/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    HERMES_DASHBOARD_EXTENSIONS: undefined as string | undefined,
  },
}));

vi.mock("@hermes/env", () => ({
  env: envMock,
}));

import {
  loadHermesDashboardExtensions,
  resetHermesDashboardExtensionsCache,
} from "./load-hermes-dashboard-extensions";

describe("loadHermesDashboardExtensions", () => {
  afterEach(() => {
    resetHermesDashboardExtensionsCache();
    envMock.HERMES_DASHBOARD_EXTENSIONS = undefined;
  });

  it("returns null when HERMES_DASHBOARD_EXTENSIONS is unset", async () => {
    await expect(loadHermesDashboardExtensions()).resolves.toBeNull();
  });
});
