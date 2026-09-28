/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { signDashboardSession } from "@/lib/dashboard-session-token";

import { config, proxy } from "./proxy";

const signedUser = encodeURIComponent(
  signDashboardSession({
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    credentialVersion: 0,
  }),
);

const validSessionCookie = `auth-token=abc; auth-user=${signedUser}`;

const legacySessionCookie = `auth-token=abc; auth-user=${encodeURIComponent(
  JSON.stringify({ id: "user-1", name: "Admin", email: "admin@example.com" }),
)}`;

describe("proxy", () => {
  it("matches the root and every dashboard route", () => {
    expect(config.matcher).toEqual(["/", "/dashboard/:path*"]);
  });

  describe("root", () => {
    it("redirects to /login without a session", () => {
      const response = proxy(new Request("https://app.test/"));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://app.test/login");
    });

    it("redirects to /dashboard with a valid signed session", () => {
      const response = proxy(
        new Request("https://app.test/", {
          headers: { cookie: `${validSessionCookie}; other=1` },
        }),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://app.test/dashboard",
      );
    });

    it("treats a whitespace-only auth-token as logged out", () => {
      const response = proxy(
        new Request("https://app.test/", {
          headers: { cookie: `auth-token=   ; auth-user=${signedUser}` },
        }),
      );

      expect(response.headers.get("location")).toBe("https://app.test/login");
    });

    it("treats a legacy unsigned session as logged out", () => {
      const response = proxy(
        new Request("https://app.test/", {
          headers: { cookie: legacySessionCookie },
        }),
      );

      expect(response.headers.get("location")).toBe("https://app.test/login");
    });

    it("uses x-forwarded-host for the redirect origin", () => {
      const response = proxy(
        new Request("http://0.0.0.0:3001/", {
          headers: {
            cookie: validSessionCookie,
            "x-forwarded-host": "dashboard.example.com",
            "x-forwarded-proto": "https",
          },
        }),
      );

      expect(response.headers.get("location")).toBe(
        "https://dashboard.example.com/dashboard",
      );
    });
  });

  describe("dashboard pages", () => {
    it("passes through with a valid signed session", () => {
      const response = proxy(
        new Request("https://app.test/dashboard/pipelines", {
          headers: { cookie: validSessionCookie },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("redirects to /login when session cookies are missing", () => {
      const response = proxy(
        new Request("https://app.test/dashboard/pipelines"),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://app.test/login");
    });

    it("clears a legacy or tampered session", () => {
      const response = proxy(
        new Request("https://app.test/dashboard", {
          headers: { cookie: legacySessionCookie },
        }),
      );

      expect(response.headers.get("location")).toBe(
        "https://app.test/clear-hermes-dashboard-session",
      );
    });

    it("leaves Bearer-authenticated requests to the route", () => {
      const response = proxy(
        new Request("https://app.test/dashboard/pipelines", {
          headers: { authorization: "Bearer hmcp_key" },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("leaves action routes to their own auth", () => {
      const response = proxy(
        new Request("https://app.test/dashboard/schedules/actions/create", {
          method: "GET",
        }),
      );

      expect(response.status).toBe(200);
    });

    it("leaves non-GET requests such as server actions alone", () => {
      const response = proxy(
        new Request("https://app.test/dashboard/pipelines", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  });

  it("returns next() for routes outside the dashboard", () => {
    const response = proxy(new Request("https://app.test/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
