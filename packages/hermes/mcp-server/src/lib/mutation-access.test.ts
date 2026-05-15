/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { HermesHttpClient } from "./http-client.js";
import {
  assertMutationAllowed,
  isReadOnlyKeyHttpResponse,
  parseWhoamiReadOnly,
} from "./mutation-access.js";

describe("parseWhoamiReadOnly", () => {
  it("returns readOnly when present", () => {
    expect(parseWhoamiReadOnly({ readOnly: true })).toBe(true);
    expect(parseWhoamiReadOnly({ readOnly: false })).toBe(false);
  });

  it("returns null for invalid bodies", () => {
    expect(parseWhoamiReadOnly(null)).toBeNull();
    expect(parseWhoamiReadOnly({})).toBeNull();
  });
});

describe("isReadOnlyKeyHttpResponse", () => {
  it("detects read_only_key 403", () => {
    expect(
      isReadOnlyKeyHttpResponse(403, {
        code: "read_only_key",
        message: "nope",
      }),
    ).toBe(true);
  });

  it("returns false for other responses", () => {
    expect(isReadOnlyKeyHttpResponse(401, { error: "Unauthorized" })).toBe(
      false,
    );
  });
});

describe("assertMutationAllowed", () => {
  it("allows when whoami reports full-access key", async () => {
    const httpClient: HermesHttpClient = {
      request: async () => ({
        status: 200,
        body: { readOnly: false, label: "full" },
        text: "{}",
      }),
    };

    const result = await assertMutationAllowed({ httpClient });
    expect(result).toEqual({ allowed: true });
  });

  it("blocks read-only keys before mutations", async () => {
    const httpClient: HermesHttpClient = {
      request: async () => ({
        status: 200,
        body: { readOnly: true },
        text: "{}",
      }),
    };

    const result = await assertMutationAllowed({ httpClient });
    expect(result).toMatchObject({ isError: true });
    const text =
      "content" in result && result.content[0]?.type === "text"
        ? result.content[0].text
        : "";
    expect(text).toContain("Read-only");
  });
});
