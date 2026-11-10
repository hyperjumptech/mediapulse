import { dashboardPageCustomActionSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import {
  tickersCustomActionsForManifest,
  tickersSyncFromKnowledgeGraphConfirmToken,
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

    for (
      let index = 0;
      index < tickersTableV1CustomActions.length;
      index += 1
    ) {
      const definition = tickersTableV1CustomActions[index];
      const registration = tickersTableV1CustomActionRegistrations[index];
      const manifestRow = tickersCustomActionsForManifest[index];
      expect(definition).toBeDefined();
      expect(registration).toBeDefined();
      expect(manifestRow).toBeDefined();

      expect(registration!.path).toBe(definition!.manifest.path);
      expect(registration!.method).toBe(definition!.manifest.method);
      expect(manifestRow!.path).toBe(definition!.manifest.path);
      expect(manifestRow!.id).toBe(definition!.manifest.id);
      expect(manifestRow!.path).toBe(`/${manifestRow!.id}`);
    }
  });

  it("offers the reset and the knowledge graph sync", () => {
    const ids = tickersCustomActionsForManifest.map((action) => action.id);

    expect(ids).toEqual(["reset-all", "sync-from-knowledge-graph"]);
  });

  it("declares the sync as a confirmed POST that Hermes accepts", () => {
    const sync = tickersCustomActionsForManifest.find(
      (action) => action.id === "sync-from-knowledge-graph",
    );
    const parsed = dashboardPageCustomActionSchema.safeParse(sync);

    expect(parsed.success).toBe(true);
    expect(sync).toMatchObject({
      label: "Sync from knowledge graph",
      ui: "danger-confirm",
      method: "POST",
      path: "/sync-from-knowledge-graph",
      confirmToken: tickersSyncFromKnowledgeGraphConfirmToken,
    });
  });
});
