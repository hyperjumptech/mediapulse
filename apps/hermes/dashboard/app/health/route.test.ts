import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /health", () => {
  it("returns domain health contract JSON", () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("parses body as domain health response", async () => {
    const res = GET();
    const body = (await res.json()) as { ok: boolean; service: string };

    expect(body).toEqual({ ok: true, service: "hermes-dashboard" });
  });
});
