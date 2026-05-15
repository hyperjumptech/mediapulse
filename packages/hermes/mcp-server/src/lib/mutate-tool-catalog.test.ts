import { describe, expect, it } from "vitest";

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
});
