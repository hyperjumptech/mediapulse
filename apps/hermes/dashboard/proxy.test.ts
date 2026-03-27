/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("exports a root-only matcher", () => {
    expect(config.matcher).toBe("/");
  });

  it("redirects to /login when auth-token cookie is missing", () => {
    const res = proxy(new Request("https://app.test/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/login");
  });

  it("redirects to /dashboard when auth-token cookie is non-empty", () => {
    const res = proxy(
      new Request("https://app.test/", {
        headers: {
          cookie: "auth-token=abc; other=1",
        },
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/dashboard");
  });

  it("treats whitespace-only auth-token as logged out", () => {
    const res = proxy(
      new Request("https://app.test/", {
        headers: {
          cookie: "auth-token=   ",
        },
      }),
    );
    expect(res.headers.get("location")).toBe("https://app.test/login");
  });

  it("uses x-forwarded-host for redirect origin on internal request URL", () => {
    const res = proxy(
      new Request("http://0.0.0.0:3001/", {
        headers: {
          cookie: "auth-token=x",
          "x-forwarded-host": "mediapulse-hermes.fly.dev",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(res.headers.get("location")).toBe(
      "https://mediapulse-hermes.fly.dev/dashboard",
    );
  });

  it("returns next() when pathname is not root", () => {
    const res = proxy(new Request("https://app.test/login"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
