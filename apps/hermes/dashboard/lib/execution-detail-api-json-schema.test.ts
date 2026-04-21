/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseExecutionDetailApiPayload } from "./execution-detail-api-json-schema";

describe("parseExecutionDetailApiPayload", () => {
  it("accepts payloads with execution.errors present (including null)", () => {
    expect(() =>
      parseExecutionDetailApiPayload({
        execution: { errors: null, id: "x" },
        pipeline: null,
      }),
    ).not.toThrow();
  });

  it("rejects payloads missing execution.errors", () => {
    expect(() =>
      parseExecutionDetailApiPayload({
        execution: { id: "x" },
      }),
    ).toThrow();
  });
});
