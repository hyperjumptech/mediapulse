/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  computeDeadUrlExpiresAt,
  isDeadUrlCacheable,
} from "./data-collection-dead-url.js";

describe("computeDeadUrlExpiresAt", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("uses 30 days for HTTP 404", () => {
    const expiresAt = computeDeadUrlExpiresAt("provider_http_error", 404, now);
    expect(expiresAt.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("uses 7 days for HTTP 403", () => {
    const expiresAt = computeDeadUrlExpiresAt("provider_http_error", 403, now);
    expect(expiresAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("uses 3 days for provider_data_invalid", () => {
    const expiresAt = computeDeadUrlExpiresAt(
      "provider_data_invalid",
      undefined,
      now,
    );
    expect(expiresAt.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

describe("isDeadUrlCacheable", () => {
  it("rejects transient categories", () => {
    expect(isDeadUrlCacheable("timeout_error")).toBe(false);
    expect(isDeadUrlCacheable("network_error")).toBe(false);
  });
});
