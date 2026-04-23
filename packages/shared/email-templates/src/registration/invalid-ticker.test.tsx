import { describe, expect, it } from "vitest";
import { renderNewsletterEmail } from "../index.js";

describe("InvalidTickerEmail", () => {
  it("renders with ticker symbol in HTML and text", async () => {
    const { html, text } = await renderNewsletterEmail({
      variant: "invalid-ticker",
      tickerSymbol: "GIBBERISH",
    });
    expect(html).toContain("GIBBERISH");
    expect(html).toContain("Invalid Ticker Selection");
    expect(text).toContain("GIBBERISH");
    expect(text).toMatch(/Invalid Ticker Selection/i);
  });
});
