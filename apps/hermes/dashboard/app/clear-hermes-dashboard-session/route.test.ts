/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("clear-hermes-dashboard-session GET", () => {
  it("redirects to /login on the same origin and clears auth cookies", () => {
    const res = GET(new Request("https://app.test/dashboard/pipelines"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/login");
    const raw = res.headers.get("set-cookie") ?? "";
    expect(raw).toContain("auth-token=");
    expect(raw).toContain("auth-user=");
    expect(raw).toContain("Max-Age=0");
  });

  it("uses x-forwarded-host when request URL is the internal bind address", () => {
    const res = GET(
      new Request("http://0.0.0.0:3001/clear-hermes-dashboard-session", {
        headers: {
          "x-forwarded-host": "mediapulse-hermes.fly.dev",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(res.headers.get("location")).toBe(
      "https://mediapulse-hermes.fly.dev/login",
    );
  });
});
