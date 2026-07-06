/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

const inputSchema = z.object({ tickerId: hermesTickerIdSchema });

/** Mirrors the production app wiring (agentVersion 3.0.0, requireContract). */
const buildApp = (run = vi.fn(async () => ({ success: true as const }))) =>
  createAgentApp(
    {
      agentId: "query-analysis",
      agentVersion: "3.0.0",
      inputSchema,
      requireContract: true,
      run,
    },
    { verifyToken: async () => true },
  );

const post = (app: ReturnType<typeof buildApp>, body: unknown) =>
  app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: "Bearer test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("query-analysis agent", () => {
  it("returns success for valid input with a contract brief", async () => {
    // Setup
    const app = buildApp();

    // Act
    const res = await post(app, {
      input: { tickerId: "ticker-1" },
      contract: { brief: "Track the issuer.", version: "1.0.0" },
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid input", async () => {
    // Setup
    const run = vi.fn();
    const app = buildApp(run);

    // Act
    const res = await post(app, {
      input: {},
      contract: { brief: "Track the issuer.", version: "1.0.0" },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 400 without invoking run when no contract brief is attached", async () => {
    // Setup
    const run = vi.fn();
    const app = buildApp(run);

    // Act
    const res = await post(app, { input: { tickerId: "ticker-1" } });

    // Assert
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
