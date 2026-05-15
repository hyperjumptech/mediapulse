/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { HermesHttpClient } from "./http-client.js";
import { HERMES_MUTATE_TOOL_SPECS } from "./mutate-tool-catalog.js";
import { handleHermesMutateToolCall } from "./register-hermes-mutate-tools.js";

const deleteAgentSpec = HERMES_MUTATE_TOOL_SPECS.find(
  (spec) => spec.name === "hermes_mutate_delete_agent",
);

describe("handleHermesMutateToolCall", () => {
  it("does not call HTTP when confirm is missing on destructive tools", async () => {
    const request = vi.fn();
    const httpClient: HermesHttpClient = { request };

    const result = await handleHermesMutateToolCall(
      deleteAgentSpec!,
      { id: "00000000-0000-4000-8000-000000000001" },
      {
        httpClient,
        assertMutationAllowed: async () => ({ allowed: true as const }),
      },
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it("calls HTTP when confirm is true", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      body: { ok: true },
      text: '{"ok":true}',
    });
    const httpClient: HermesHttpClient = { request };

    await handleHermesMutateToolCall(
      deleteAgentSpec!,
      {
        id: "00000000-0000-4000-8000-000000000001",
        confirm: true,
      },
      {
        httpClient,
        assertMutationAllowed: async () => ({ allowed: true as const }),
      },
    );

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/dashboard/agents/actions/delete",
      body: { id: "00000000-0000-4000-8000-000000000001" },
    });
  });

  it("blocks read-only keys via assertMutationAllowed", async () => {
    const request = vi.fn();
    const httpClient: HermesHttpClient = { request };

    const result = await handleHermesMutateToolCall(
      deleteAgentSpec!,
      {
        id: "00000000-0000-4000-8000-000000000001",
        confirm: true,
      },
      {
        httpClient,
        assertMutationAllowed: async () => ({
          content: [{ type: "text" as const, text: '{"error":"ro"}' }],
          isError: true,
        }),
      },
    );

    expect(request).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });
});
