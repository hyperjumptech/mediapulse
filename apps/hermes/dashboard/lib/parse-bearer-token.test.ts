/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseBearerToken } from "./parse-bearer-token";

describe("parseBearerToken", () => {
  it("returns token from Bearer header", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer hmcp_abc_secret" },
    });
    expect(parseBearerToken(req)).toBe("hmcp_abc_secret");
  });

  it("returns null when header missing", () => {
    expect(parseBearerToken(new Request("http://localhost"))).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    const req = new Request("http://localhost", {
      headers: { Authorization: "Basic abc" },
    });
    expect(parseBearerToken(req)).toBeNull();
  });
});
