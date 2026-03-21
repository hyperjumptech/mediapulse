/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { validateScheduleParams } from "./validate-schedule-params";

describe("validateScheduleParams", () => {
  it("returns valid: true when pipeline has no steps", async () => {
    // Setup
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          steps: [],
        }),
      },
    } as unknown as Parameters<typeof validateScheduleParams>[0];

    // Act
    const result = await validateScheduleParams(db, "p1", { tickerId: "123" });

    // Assert
    expect(result.valid).toBe(true);
  });

  it("returns valid: false when agent has no input schema", async () => {
    // Setup
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          steps: [{ agentId: "agent-a", agentVersion: "1.0.0" }],
        }),
      },
      agentRegistry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { agentId: "agent-a", agentVersion: "1.0.0", inputSchema: null },
          ]),
      },
    } as unknown as Parameters<typeof validateScheduleParams>[0];

    // Act
    const result = await validateScheduleParams(db, "p1", { tickerId: "123" });

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("no input schema");
    }
  });

  it("returns valid: true when params satisfy all steps' input schemas", async () => {
    // Setup
    const schema = {
      type: "object",
      properties: { tickerId: { type: "string" } },
      required: ["tickerId"],
    };
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          steps: [{ agentId: "agent-a", agentVersion: "1.0.0" }],
        }),
      },
      agentRegistry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { agentId: "agent-a", agentVersion: "1.0.0", inputSchema: schema },
          ]),
      },
    } as unknown as Parameters<typeof validateScheduleParams>[0];

    // Act
    const result = await validateScheduleParams(db, "p1", { tickerId: "123" });

    // Assert
    expect(result.valid).toBe(true);
  });

  it("returns valid: false when params fail a step's input schema", async () => {
    // Setup — schema expects tickerId to be a number
    const schema = {
      type: "object",
      properties: { tickerId: { type: "number" } },
      required: ["tickerId"],
    };
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          steps: [{ agentId: "agent-a", agentVersion: "1.0.0" }],
        }),
      },
      agentRegistry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { agentId: "agent-a", agentVersion: "1.0.0", inputSchema: schema },
          ]),
      },
    } as unknown as Parameters<typeof validateScheduleParams>[0];

    // Act
    const result = await validateScheduleParams(db, "p1", {
      tickerId: "string-not-number",
    });

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("agent-a");
    }
  });
});
