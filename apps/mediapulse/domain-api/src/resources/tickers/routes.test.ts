/**
 * Route wiring tests for tickers (custom action registration on the Hono app).
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { tickersRoutes } from "./routes";
import { tickersTableV1CustomActions } from "./custom-actions";

describe("tickersRoutes", () => {
  it("registers POST for the IDX import path declared on the dashboard manifest", async () => {
    // Setup
    const importIdx = tickersTableV1CustomActions[0];
    expect(importIdx).toBeDefined();

    // Act — empty body fails validation before DB; 404 would mean path drift vs manifest.
    const res = await tickersRoutes.request(
      `http://localhost${importIdx!.manifest.path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    // Assert
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(400);
  });
});
