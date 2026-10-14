import { describe, expect, it } from "vitest";

import { buildUnsubscribeLinks } from "./unsubscribe-links.js";

describe("buildUnsubscribeLinks", () => {
  it("points the footer at the confirmation page and the header at the one-click endpoint", () => {
    const links = buildUnsubscribeLinks({
      userTickerId: "ut-1",
      tickerSymbol: "TLKM",
      language: "id",
      settings: { baseUrl: "https://register.example.com/", secret: "s" },
    });

    expect(links.unsubscribeUrl).toMatch(
      /^https:\/\/register\.example\.com\/unsubscribe\?token=[^&]+&lang=id$/,
    );
    expect(links.oneClickUnsubscribeUrl).toMatch(
      /^https:\/\/register\.example\.com\/api\/unsubscribe\?token=[^&]+$/,
    );
  });
});
