/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { loadRegistrationTickers } from "./load-registration-tickers";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.test",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "reg@example.com",
  },
}));

describe("loadRegistrationTickers", () => {
  it("maps API rows through the ticker schema", async () => {
    const createClient = vi.fn().mockReturnValue({
      userRegistrationTickers: {
        get: vi.fn().mockResolvedValue({
          tickers: [{ symbol: "BBCA", name: "Bank Central Asia Tbk" }],
        }),
      },
    });

    const result = await loadRegistrationTickers(createClient);

    expect(createClient).toHaveBeenCalledWith({
      baseUrl: "http://agent-data-api.test",
      version: "v1",
    });
    expect(result).toEqual([
      { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
    ]);
  });
});
