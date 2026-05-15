/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp-api-keys", () => ({
  validateApiKey: vi.fn(),
}));

import { validateApiKey } from "@/lib/mcp-api-keys";
import { GET } from "./route";

describe("GET /api/mcp/whoami", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without Authorization header", async () => {
    const res = await GET(new Request("http://localhost/api/mcp/whoami"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid key", async () => {
    vi.mocked(validateApiKey).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/mcp/whoami", {
        headers: { Authorization: "Bearer hmcp_bad" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns key metadata for valid key", async () => {
    vi.mocked(validateApiKey).mockResolvedValue({
      id: "key-1",
      label: "Cursor",
      readOnly: true,
      createdByUserId: "user-1",
    });
    const res = await GET(
      new Request("http://localhost/api/mcp/whoami", {
        headers: { Authorization: "Bearer hmcp_ok_secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      label: "Cursor",
      readOnly: true,
      keyId: "key-1",
      user: { id: "user-1" },
    });
    expect(JSON.stringify(body)).not.toContain("hmcp_ok_secret");
  });
});
