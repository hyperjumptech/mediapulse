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

  it("renders success html for GET unsubscribe", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "unsubscribed", displaySymbol: "BBCA" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/unsubscribe?token=test-token"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Unsubscribed");
    expect(body).toContain("BBCA");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://agent-data-api.internal/api/v1/user-registration-unsubscribe?token=test-token",
      { method: "GET", cache: "no-store" },
    );
  });

  it("returns fallback html when GET upstream fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/unsubscribe?token=test-token"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("temporarily unavailable");
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
});
