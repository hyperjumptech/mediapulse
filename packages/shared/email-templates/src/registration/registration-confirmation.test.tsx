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

  it("frames the delivery time as when the ticker is reviewed, not when an issue is sent", async () => {
    const { html, text } = await renderNewsletterEmail({
      variant: "registration-confirmation",
      tickerSymbol: "AAPL",
      reviewTimeLabel: "9:00 AM WIB",
    });

    expect(html).toContain(
      "We check AAPL news every day at 9:00 AM WIB and send you an issue only when there is news worth reading.",
    );
    expect(text).toContain("9:00 AM WIB");
    expect(html).not.toMatch(/first newsletter/i);
  });

  it("tells the reader quiet days are expected, with or without a review time", async () => {
    const withLabel = await renderNewsletterEmail({
      variant: "registration-confirmation",
      tickerSymbol: "AAPL",
      reviewTimeLabel: "9:00 AM WIB",
    });
    const withoutLabel = await renderNewsletterEmail({
      variant: "registration-confirmation",
      tickerSymbol: "AAPL",
    });

    expect(withLabel.html).toMatch(/On quiet days you will not hear from us/i);
    expect(withoutLabel.html).toMatch(
      /On quiet days you will not hear from us/i,
    );
    expect(withoutLabel.html).toContain(
      "We check AAPL news every day and send you an issue only when there is news worth reading.",
    );
  });

  it("mentions the attached contact card in HTML and text", async () => {
    const { html, text } = await renderNewsletterEmail({
      variant: "registration-confirmation",
      tickerSymbol: "AAPL",
    });
    expect(html).toMatch(/contact card/i);
    expect(text).toMatch(/contact card/i);
  });
});
