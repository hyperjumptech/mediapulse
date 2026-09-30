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
      if (spec.requiresConfirm && spec.confirmReason !== "credential") {
        expect(spec.annotations.destructiveHint, spec.name).toBe(true);
      }
      if (spec.confirmReason === "credential") {
        expect(spec.requiresConfirm, spec.name).toBe(true);
        expect(spec.secretFields?.length, spec.name).toBeGreaterThan(0);
        expect(spec.inputSchema, spec.name).toHaveProperty("secretFilePath");
      }
    }
  });
});

const createIntegrationSpec = HERMES_MUTATE_TOOL_SPECS.find(
  (spec) => spec.name === "hermes_mutate_create_domain_integration",
);

const createdIntegration = {
  id: "00000000-0000-4000-8000-000000000001",
  integrationId: "acme",
  name: "Acme",
  apiKeyPlaintext: "plain-secret",
};

const allowMutation = async () => ({ allowed: true as const });

describe("handleHermesMutateToolCall secret files", () => {
  it("writes the secret to the file and keeps it out of the result", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, body: createdIntegration, text: "" });
    const writeSecretFile = vi.fn().mockResolvedValue(undefined);

    const result = await handleHermesMutateToolCall(
      createIntegrationSpec!,
      {
        integrationId: "acme",
        name: "Acme",
        secretFilePath: "/tmp/acme.key",
        confirm: true,
      },
      {
        httpClient: { request },
        assertMutationAllowed: allowMutation,
        writeSecretFile,
      },
    );

    const text = JSON.stringify(result.content);
    expect(writeSecretFile).toHaveBeenCalledWith(
      "/tmp/acme.key",
      "plain-secret\n",
    );
    expect(text).not.toContain("plain-secret");
    expect(text).toContain("[written to /tmp/acme.key]");
    expect(request.mock.calls[0]?.[0].body).toEqual({
      integrationId: "acme",
      name: "Acme",
    });
  });

  it("returns the secret with a warning when the file cannot be written", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, body: createdIntegration, text: "" });
    const writeSecretFile = vi
      .fn()
      .mockRejectedValue(new Error("EEXIST: file already exists"));

    const result = await handleHermesMutateToolCall(
      createIntegrationSpec!,
      {
        integrationId: "acme",
        name: "Acme",
        secretFilePath: "/tmp/acme.key",
        confirm: true,
      },
      {
        httpClient: { request },
        assertMutationAllowed: allowMutation,
        writeSecretFile,
      },
    );

    const text = JSON.stringify(result.content);
    expect(text).toContain("plain-secret");
    expect(text).toContain("EEXIST");
  });

  it("needs confirm before creating a credential", async () => {
    const request = vi.fn();

    const result = await handleHermesMutateToolCall(
      createIntegrationSpec!,
      { integrationId: "acme", name: "Acme" },
      { httpClient: { request }, assertMutationAllowed: allowMutation },
    );

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

const runDomainActionSpec = HERMES_MUTATE_TOOL_SPECS.find(
  (spec) => spec.name === "hermes_mutate_run_domain_action",
);

describe("handleHermesMutateToolCall payload files", () => {
  it("sends the file text as payloadJson", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, body: { added: 3 }, text: "" });
    const readPayloadFile = vi.fn().mockResolvedValue('[{"code":"A"}]');

    await handleHermesMutateToolCall(
      runDomainActionSpec!,
      {
        integrationId: "acme",
        resource: "orders",
        actionId: "import",
        payloadFilePath: "/data/orders.json",
        confirm: true,
      },
      {
        httpClient: { request },
        assertMutationAllowed: allowMutation,
        readPayloadFile,
      },
    );

    expect(readPayloadFile).toHaveBeenCalledWith("/data/orders.json");
    expect(request.mock.calls[0]?.[0].body).toEqual({
      integrationId: "acme",
      resource: "orders",
      actionId: "import",
      payloadJson: '[{"code":"A"}]',
    });
  });

  it("refuses payloadJson and payloadFilePath together", async () => {
    const request = vi.fn();

    const result = await handleHermesMutateToolCall(
      runDomainActionSpec!,
      {
        integrationId: "acme",
        resource: "orders",
        actionId: "import",
        payloadJson: "[]",
        payloadFilePath: "/data/orders.json",
        confirm: true,
      },
      { httpClient: { request }, assertMutationAllowed: allowMutation },
    );

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("reports a file it cannot read without calling Hermes", async () => {
    const request = vi.fn();

    const result = await handleHermesMutateToolCall(
      runDomainActionSpec!,
      {
        integrationId: "acme",
        resource: "orders",
        actionId: "import",
        payloadFilePath: "/data/missing.json",
        confirm: true,
      },
      {
        httpClient: { request },
        assertMutationAllowed: allowMutation,
        readPayloadFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
      },
    );

    expect(JSON.stringify(result.content)).toContain("ENOENT");
    expect(request).not.toHaveBeenCalled();
  });
});
