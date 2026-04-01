/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAgentApp } from "@workspace/agent-runtime";
import { z } from "zod";

const inputSchema = z.object({ tickerId: z.string().min(1) });

describe("query-analysis agent", () => {
  it("returns success for valid input", async () => {
    // Setup
    const app = createAgentApp(
      {
        agentId: "query-analysis",
        agentVersion: "1.0.0",
        inputSchema,
        run: async () => ({ success: true }),
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { tickerId: "ticker-1" } }),
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid input", async () => {
    // Setup
    const run = vi.fn();
    const app = createAgentApp(
      {
        agentId: "query-analysis",
        agentVersion: "1.0.0",
        inputSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    // Act
    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: {} }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
