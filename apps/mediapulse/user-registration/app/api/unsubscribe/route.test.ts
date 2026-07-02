/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

describe("user-registration unsubscribe route", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects GET to the confirmation page without unsubscribing", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/unsubscribe?token=test-token&lang=id"),
    );

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/unsubscribe");
    expect(location.searchParams.get("token")).toBe("test-token");
    expect(location.searchParams.get("lang")).toBe("id");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects GET with no token to the confirmation page", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/unsubscribe"));

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/unsubscribe");
    expect(location.searchParams.has("token")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty 200 for POST one-click and forwards token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "unsubscribed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/unsubscribe?token=test-token", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://agent-data-api.internal/api/v1/user-registration-unsubscribe",
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "test-token" }),
      },
    );
  });

  it("returns empty 200 for POST one-click even when upstream fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/unsubscribe?token=test-token", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
