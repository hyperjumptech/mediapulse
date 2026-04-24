import { describe, expect, it } from "vitest";
import { renderNewsletterEmail } from "../index.js";

describe("RegistrationConfirmationEmail", () => {
  it("renders with ticker symbol in HTML and text", async () => {
    const { html, text } = await renderNewsletterEmail({
      variant: "registration-confirmation",
      tickerSymbol: "AAPL",
    });
    expect(html).toContain("AAPL");
    expect(html).toContain("Subscription Confirmed");
    expect(text).toContain("AAPL");
    expect(text).toMatch(/Subscription Confirmed/i);
  });
});
