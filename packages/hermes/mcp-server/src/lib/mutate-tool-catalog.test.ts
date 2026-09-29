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
});
