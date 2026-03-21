/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createAgentApp } from "@workspace/agent-runtime";
import { z } from "zod";

const InputSchema = z.object({
  tickerId: z.string().min(1),
});

type Input = z.infer<typeof InputSchema>;

describe("ticker-echo agent", () => {
  it("returns 200 and success when input has tickerId", async () => {
    const app = createAgentApp<Input, typeof InputSchema>(
      {
        agentId: "ticker-echo",
        agentVersion: "1.0.0",
        inputSchema: InputSchema,
        run: async ({ input }) => {
          expect(input.tickerId).toBe("test-ticker-123");
          return { success: true };
        },
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { tickerId: "test-ticker-123" } }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agentId: string;
      agentVersion: string;
    };
    expect(body.agentId).toBe("ticker-echo");
    expect(body.agentVersion).toBe("1.0.0");
  });

  it("returns 400 when tickerId is missing", async () => {
    const run = vi.fn();
    const app = createAgentApp<Input, typeof InputSchema>(
      {
        agentId: "ticker-echo",
        agentVersion: "1.0.0",
        inputSchema: InputSchema,
        run,
      },
      { verifyToken: async () => true },
    );

    const res = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: {} }),
    });

    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
