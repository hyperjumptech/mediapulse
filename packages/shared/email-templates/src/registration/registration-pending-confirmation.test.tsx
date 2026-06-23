import { describe, expect, it } from "vitest";
import { renderNewsletterEmail } from "../index.js";

describe("RegistrationPendingConfirmationEmail", () => {
  it("renders ticker symbol and confirm URL in HTML and text", async () => {
    const confirmUrl = "https://subscribe.example.com/api/confirm?token=abc";
    const { html, text } = await renderNewsletterEmail({
      variant: "registration-pending-confirmation",
      tickerSymbol: "BBCA",
      name: "Alice",
      confirmUrl,
    });

    expect(html).toContain("BBCA");
    expect(html).toContain("Confirm your subscription");
    expect(html).toContain(confirmUrl);
    expect(text).toContain("BBCA");
    expect(text).toContain(confirmUrl);
  });
});
