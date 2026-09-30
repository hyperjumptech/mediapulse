/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { HermesHttpClient } from "./http-client.js";
import { HERMES_MUTATE_TOOL_SPECS } from "./mutate-tool-catalog.js";
import { createWhoamiCache } from "./mutation-access.js";
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

  it("reuses the cached whoami verdict across mutations for one profile", async () => {
    const request = vi
      .fn()
      .mockImplementation(async ({ path }) =>
        path === "/api/mcp/whoami"
          ? { status: 200, body: { readOnly: false }, text: "{}" }
          : { status: 200, body: { ok: true }, text: '{"ok":true}' },
      );
    const httpClient: HermesHttpClient = { request };
    const whoamiCache = createWhoamiCache();
    const dependencies = {
      httpClient,
      whoamiCache,
      resolveProfileKey: () => "PROD",
    };
    const args = { id: "00000000-0000-4000-8000-000000000001", confirm: true };

    await handleHermesMutateToolCall(deleteAgentSpec!, args, dependencies);
    await handleHermesMutateToolCall(deleteAgentSpec!, args, dependencies);

    const whoamiCalls = request.mock.calls.filter(
      ([call]) => call.path === "/api/mcp/whoami",
    );
    expect(whoamiCalls).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("returns compact JSON of the mutation response", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      body: { success: true, id: "x" },
      text: "",
    });

    const result = await handleHermesMutateToolCall(
      deleteAgentSpec!,
      { id: "00000000-0000-4000-8000-000000000001", confirm: true },
      {
        httpClient: { request },
        assertMutationAllowed: async () => ({ allowed: true as const }),
      },
    );

    expect(result.content[0]).toEqual({
      type: "text",
      text: '{"success":true,"id":"x"}',
    });
  });
});

describe("HERMES_MUTATE_TOOL_SPECS annotations", () => {
  it("marks deletes and updates destructive and idempotent, creates additive", () => {
    for (const spec of HERMES_MUTATE_TOOL_SPECS) {
      expect(spec.title.length, spec.name).toBeGreaterThan(0);
      expect(spec.annotations.readOnlyHint, spec.name).toBe(false);
      if (/_(delete|remove|update)_/.test(spec.name)) {
        expect(spec.annotations.destructiveHint, spec.name).toBe(true);
        expect(spec.annotations.idempotentHint, spec.name).toBe(true);
      }
      if (/_(create|add)_/.test(spec.name)) {
        expect(spec.annotations.destructiveHint, spec.name).toBe(false);
      }
      if (spec.requiresConfirm) {
        expect(spec.annotations.destructiveHint, spec.name).toBe(true);
      }
    }
  });
});
