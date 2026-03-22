/**
 * Tests for tickers custom-action manifest snippets and registration list shape.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  tickersCustomActionsForManifest,
  tickersTableV1CustomActionRegistrations,
  tickersTableV1CustomActions,
} from "./custom-actions";

describe("tickersTableV1CustomActions", () => {
  it("exposes the same path and method on manifest rows and route registrations", () => {
    expect(tickersTableV1CustomActions.length).toBe(
      tickersTableV1CustomActionRegistrations.length,
    );
    expect(tickersCustomActionsForManifest.length).toBe(
      tickersTableV1CustomActions.length,
    );

    for (let i = 0; i < tickersTableV1CustomActions.length; i += 1) {
      const def = tickersTableV1CustomActions[i];
      const reg = tickersTableV1CustomActionRegistrations[i];
      const manifestRow = tickersCustomActionsForManifest[i];
      expect(def).toBeDefined();
      expect(reg).toBeDefined();
      expect(manifestRow).toBeDefined();

      expect(reg!.path).toBe(def!.manifest.path);
      expect(reg!.method).toBe(def!.manifest.method);
      expect(manifestRow!.path).toBe(def!.manifest.path);
      expect(manifestRow!.id).toBe(def!.manifest.id);
      expect(manifestRow!.path).toBe(`/${manifestRow!.id}`);
    }
  });
});
