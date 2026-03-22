import { describe, expect, it } from "vitest";

import { parseHttpErrorBodyMessage } from "./parse-http-error-body-message";

describe("parseHttpErrorBodyMessage", () => {
  it("returns undefined for empty or non-JSON", () => {
    expect(parseHttpErrorBodyMessage("")).toBeUndefined();
    expect(parseHttpErrorBodyMessage("not json")).toBeUndefined();
    expect(parseHttpErrorBodyMessage("[]")).toBeUndefined();
  });

  it("returns message from agent-style 404 body", () => {
    const body = JSON.stringify({
      agentId: "content-generation",
      agentVersion: "1.0.0",
      skipped: true,
      message: "No data sources found for this ticker",
    });
    expect(parseHttpErrorBodyMessage(body)).toBe(
      "No data sources found for this ticker",
    );
  });

  it("returns undefined when message is missing or empty", () => {
    expect(parseHttpErrorBodyMessage("{}")).toBeUndefined();
    expect(
      parseHttpErrorBodyMessage(JSON.stringify({ message: "" })),
    ).toBeUndefined();
  });

  it("returns undefined on invalid JSON", () => {
    expect(parseHttpErrorBodyMessage("{")).toBeUndefined();
  });
});
