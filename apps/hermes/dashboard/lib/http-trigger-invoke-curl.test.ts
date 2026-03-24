import { describe, expect, it } from "vitest";
import { buildHttpTriggerInvokeCurlCommand } from "./http-trigger-invoke-curl";

describe("buildHttpTriggerInvokeCurlCommand", () => {
  it("includes method, URL, and Bearer placeholder", () => {
    expect(
      buildHttpTriggerInvokeCurlCommand({
        method: "POST",
        triggerId: "tri_1",
        origin: "https://example.com",
      }),
    ).toBe(
      'curl -X POST "https://example.com/api/http-triggers/tri_1/invoke" -H "Authorization: Bearer <YOUR_TRIGGER_TOKEN>"',
    );
  });

  it("supports GET", () => {
    expect(
      buildHttpTriggerInvokeCurlCommand({
        method: "GET",
        triggerId: "abc",
        origin: "http://localhost:3000",
      }),
    ).toBe(
      'curl -X GET "http://localhost:3000/api/http-triggers/abc/invoke" -H "Authorization: Bearer <YOUR_TRIGGER_TOKEN>"',
    );
  });
});
