/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { parseAgentResponseEnvelope } from "./agent-response-envelope";

describe("parseAgentResponseEnvelope", () => {
  it("treats empty body as legacy success", () => {
    const r = parseAgentResponseEnvelope("", true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.envelope.status).toBe("success");
    }
  });

  it("parses valid success envelope", () => {
    const r = parseAgentResponseEnvelope(
      '{"schemaVersion":1,"status":"success","message":"ok"}',
      false,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const r = parseAgentResponseEnvelope("{", false);
    expect(r.ok).toBe(false);
  });
});
