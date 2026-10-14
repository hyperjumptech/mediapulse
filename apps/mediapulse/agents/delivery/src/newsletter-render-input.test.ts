import { describe, expect, it } from "vitest";

import {
  buildNewsletterRenderInput,
  type NewsletterRenderInputOptions,
} from "./newsletter-render-input.js";

const baseOptions = (
  overrides: Partial<NewsletterRenderInputOptions> = {},
): NewsletterRenderInputOptions => ({
  userTickerId: "user-ticker-1",
  language: "en",
  title: "Subject",
  bodyText: "Body",
  unsubscribeUrl: "https://example.com/unsubscribe?token=t",
  tickerSymbol: "TLKM",
  template: {
    newsletterVariant: "default",
    reviewTimeLabels: { en: "7:00 AM WIB", id: "07.00 WIB" },
  },
  day1FirstIssueUserTickerIds: [],
  ...overrides,
});

describe("buildNewsletterRenderInput", () => {
  it("renders the configured variant when no day-1 subscriber is set", () => {
    const input = buildNewsletterRenderInput(baseOptions());

    expect(input).toEqual({
      title: "Subject",
      bodyText: "Body",
      variant: "default",
      unsubscribeUrl: "https://example.com/unsubscribe?token=t",
      tickerSymbol: "TLKM",
      language: "en",
    });
  });

  it("renders the configured variant for every other subscriber", () => {
    const input = buildNewsletterRenderInput(
      baseOptions({ day1FirstIssueUserTickerIds: ["user-ticker-2"] }),
    );

    expect(input.variant).toBe("default");
  });

  it.each([
    ["en", "7:00 AM WIB"],
    ["id", "07.00 WIB"],
  ] as const)(
    "renders the first-issue note with the %s review time label",
    (language, reviewTimeLabel) => {
      const input = buildNewsletterRenderInput(
        baseOptions({
          language,
          day1FirstIssueUserTickerIds: ["user-ticker-1"],
        }),
      );

      expect(input).toEqual({
        variant: "day1-first-issue",
        title: "Subject",
        bodyText: "Body",
        unsubscribeUrl: "https://example.com/unsubscribe?token=t",
        tickerSymbol: "TLKM",
        language,
        reviewTimeLabel,
      });
    },
  );

  it("leaves out the review time label when none is configured for the language", () => {
    const input = buildNewsletterRenderInput(
      baseOptions({
        language: "id",
        template: {
          newsletterVariant: "default",
          reviewTimeLabels: { en: "7:00 AM WIB" },
        },
        day1FirstIssueUserTickerIds: ["user-ticker-1"],
      }),
    );

    expect(input.variant).toBe("day1-first-issue");
    expect(input).not.toHaveProperty("reviewTimeLabel");
  });
});
