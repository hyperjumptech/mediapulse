/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import app from "./index";

describe("query-analysis agent", () => {
  it("GET /schemas returns 200", async () => {
    const res = await app.fetch(new Request("http://localhost/schemas"));
    expect(res.status).toBe(200);
  });
});
