/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { resolvePublicOrigin } from "./resolve-public-origin";

describe("resolvePublicOrigin", () => {
  it("uses request.url origin when forwarded host is absent", () => {
    expect(
      resolvePublicOrigin(
        new Request("https://app.test/clear-hermes-dashboard-session"),
      ),
    ).toBe("https://app.test");
  });

  it("prefers x-forwarded-host and x-forwarded-proto when set", () => {
    expect(
      resolvePublicOrigin(
        new Request("http://0.0.0.0:3001/path", {
          headers: {
            "x-forwarded-host": "dashboard.example.com",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe("https://dashboard.example.com");
  });

  it("defaults proto to https when forwarded host is set but proto is missing", () => {
    expect(
      resolvePublicOrigin(
        new Request("http://127.0.0.1:3001/", {
          headers: {
            "x-forwarded-host": "example.com",
          },
        }),
      ),
    ).toBe("https://example.com");
  });

  it("uses first value when forwarded headers are comma-separated", () => {
    expect(
      resolvePublicOrigin(
        new Request("http://localhost/", {
          headers: {
            "x-forwarded-host": "a.example.com, b.example.com",
            "x-forwarded-proto": "https, http",
          },
        }),
      ),
    ).toBe("https://a.example.com");
  });
});
