import { describe, expect, it } from "vitest";
import { renderNewsletterEmail } from "../index.js";

describe("AlreadySubscribedEmail", () => {
  it("renders with ticker symbol in HTML and text", async () => {
    const { html, text } = await renderNewsletterEmail({
      variant: "already-subscribed",
      tickerSymbol: "BBCA",
    });
    expect(html).toContain("BBCA");
    expect(html).toContain("Already Subscribed");
    expect(text).toContain("BBCA");
    expect(text).toMatch(/Already Subscribed/i);
  });
});
