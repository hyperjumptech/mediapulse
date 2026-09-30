import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildMutationRequestBody,
  HERMES_MUTATE_TOOL_SPECS,
} from "./mutate-tool-catalog.js";

describe("buildMutationRequestBody", () => {
  it("omits confirm from the HTTP body", () => {
    expect(
      buildMutationRequestBody({
        id: "00000000-0000-4000-8000-000000000001",
        confirm: true,
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
    });
  });
});

describe("HERMES_MUTATE_TOOL_SPECS", () => {
  it("marks destructive routes as requiring confirm", () => {
    const deleteAgent = HERMES_MUTATE_TOOL_SPECS.find(
      (spec) => spec.name === "hermes_mutate_delete_agent",
    );
    expect(deleteAgent?.requiresConfirm).toBe(true);
    expect(deleteAgent?.pathTemplate).toBe("/dashboard/agents/actions/delete");
  });

  it("lets a manual pipeline run carry run parameters", () => {
    const runPipeline = HERMES_MUTATE_TOOL_SPECS.find(
      (spec) => spec.name === "hermes_mutate_run_pipeline",
    );
    const inputSchema = z.object(runPipeline?.inputSchema ?? {});
    const pipelineId = "00000000-0000-4000-8000-000000000001";

    expect(
      inputSchema.safeParse({ pipelineId, params: { itemId: "abc", limit: 2 } })
        .success,
    ).toBe(true);
    expect(inputSchema.safeParse({ pipelineId }).success).toBe(true);
    expect(
      inputSchema.safeParse({
        pipelineId,
        params: { itemId: { nested: true } },
      }).success,
    ).toBe(false);
  });

  it("forwards run parameters in the HTTP body", () => {
    expect(
      buildMutationRequestBody({
        pipelineId: "00000000-0000-4000-8000-000000000001",
        params: { itemId: "abc" },
        confirm: true,
      }),
    ).toEqual({
      pipelineId: "00000000-0000-4000-8000-000000000001",
      params: { itemId: "abc" },
    });
  });

  it("requires an endpoint object when creating an agent", () => {
    const createAgent = HERMES_MUTATE_TOOL_SPECS.find(
      (spec) => spec.name === "hermes_mutate_create_agent",
    );
    const inputSchema = z.object(createAgent?.inputSchema ?? {});

    const withEndpoint = inputSchema.safeParse({
      agentId: "summarizer",
      agentVersion: "1.0.0",
      endpoint: { url: "https://agent.example.com" },
    });
    const withoutEndpoint = inputSchema.safeParse({
      agentId: "summarizer",
      agentVersion: "1.0.0",
    });

    expect(withEndpoint.success).toBe(true);
    expect(withoutEndpoint.success).toBe(false);
  });

  it("uses unique tool names and one-line descriptions", () => {
    const names = HERMES_MUTATE_TOOL_SPECS.map((spec) => spec.name);

    expect(new Set(names).size).toBe(names.length);
    for (const spec of HERMES_MUTATE_TOOL_SPECS) {
      expect(spec.description, spec.name).not.toContain("\n");
    }
  });
});
