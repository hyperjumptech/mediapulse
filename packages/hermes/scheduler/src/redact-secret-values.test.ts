import { describe, expect, it } from "vitest";

import {
  collectSecretValues,
  redactSecretValues,
  REDACTED_PLACEHOLDER,
} from "./redact-secret-values";

describe("collectSecretValues", () => {
  it("drops blank values so they cannot match every string", () => {
    const collected = collectSecretValues(["", "   ", "real-secret"]);

    expect(collected).toEqual(["real-secret"]);
  });

  it("removes duplicates", () => {
    const collected = collectSecretValues(["dup", "dup"]);

    expect(collected).toEqual(["dup"]);
  });

  it("orders longest first so an overlapping shorter secret cannot mask it", () => {
    const collected = collectSecretValues(["abc", "abcdef"]);

    expect(collected).toEqual(["abcdef", "abc"]);
  });
});

describe("redactSecretValues", () => {
  it("redacts a secret held as a whole string value", () => {
    const secrets = collectSecretValues(["sk-live-abc123"]);
    const redacted = redactSecretValues(
      { model: { apiKey: "sk-live-abc123", model: "gpt-4.1-mini" } },
      secrets,
    );

    expect(redacted).toEqual({
      model: { apiKey: REDACTED_PLACEHOLDER, model: "gpt-4.1-mini" },
    });
  });

  it("redacts a secret embedded inside a larger string", () => {
    const secrets = collectSecretValues(["abc123"]);
    const redacted = redactSecretValues(
      { authorization: "Bearer abc123" },
      secrets,
    );

    expect(redacted).toEqual({
      authorization: `Bearer ${REDACTED_PLACEHOLDER}`,
    });
  });

  it("reaches secrets nested in arrays", () => {
    const secrets = collectSecretValues(["serper-key"]);
    const redacted = redactSecretValues(
      { fetch: { providers: [{ provider: "serper", apiKey: "serper-key" }] } },
      secrets,
    );

    expect(redacted).toEqual({
      fetch: {
        providers: [{ provider: "serper", apiKey: REDACTED_PLACEHOLDER }],
      },
    });
  });

  it("leaves non-secret config untouched", () => {
    const secrets = collectSecretValues(["sk-live-abc123"]);
    const config = { limit: 10, model: "gpt-4.1-mini", enabled: true };
    const redacted = redactSecretValues(config, secrets);

    expect(redacted).toEqual(config);
  });

  it("returns the value unchanged when there are no secrets", () => {
    const config = { apiKey: "not-a-known-secret" };
    const redacted = redactSecretValues(config, collectSecretValues([]));

    expect(redacted).toEqual(config);
  });

  it("does not mutate the input", () => {
    const secrets = collectSecretValues(["sk-live-abc123"]);
    const config = { model: { apiKey: "sk-live-abc123" } };
    redactSecretValues(config, secrets);

    expect(config.model.apiKey).toBe("sk-live-abc123");
  });

  it("preserves null and numeric values", () => {
    const secrets = collectSecretValues(["sk-live-abc123"]);
    const redacted = redactSecretValues(
      { nothing: null, count: 3, nested: [null, 1] },
      secrets,
    );

    expect(redacted).toEqual({ nothing: null, count: 3, nested: [null, 1] });
  });
});
