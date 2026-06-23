/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import {
  buildMailtoUrl,
  buildOutlookComposeUrl,
  buildRegistrationMailDraft,
  openMailClientUrl,
} from "./mail-app-urls";

const ticker = { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" };

describe("buildRegistrationMailDraft", () => {
  it("builds subject and body with name, ticker, and language", () => {
    const draft = buildRegistrationMailDraft({
      ticker,
      name: "Jane Doe",
      language: "id",
      registrationEmail: "registration@test.example",
    });

    expect(draft.subject).toBe("[MediaPulse] Newsletter Subscription - BBCA");
    expect(draft.body).toContain("Name: Jane Doe");
    expect(draft.body).toContain("Ticker: BBCA");
    expect(draft.body).toContain("Language: id");
  });
});

describe("buildMailtoUrl", () => {
  it("returns a mailto URL with encoded subject and body", () => {
    const url = buildMailtoUrl(
      ticker,
      "Jane Doe",
      "en",
      "registration@test.example",
    );

    expect(url.startsWith("mailto:registration@test.example")).toBe(true);
    expect(url).toContain(encodeURIComponent("Name: Jane Doe"));
  });
});

describe("buildOutlookComposeUrl", () => {
  it("returns an ms-outlook compose URL with a valid authority", () => {
    const url = buildOutlookComposeUrl(
      ticker,
      "Jane Doe",
      "en",
      "registration@test.example",
    );

    expect(url.startsWith("ms-outlook://compose?")).toBe(true);
    expect(url).toContain("to=registration%40test.example");
    expect(url).toContain(encodeURIComponent("Name: Jane Doe"));
    expect(url).not.toMatch(/[?&][^=]*\+/);
  });

  it("uses the iOS Outlook deep link path for iPhone user agents", () => {
    const url = buildOutlookComposeUrl(
      ticker,
      "Jane Doe",
      "en",
      "registration@test.example",
      {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    );

    expect(url.startsWith("ms-outlook://emails/new?")).toBe(true);
  });
});

describe("openMailClientUrl", () => {
  it("delegates to the injected opener", () => {
    const openUrl = vi.fn();
    openMailClientUrl("mailto:test@example.com", openUrl);
    expect(openUrl).toHaveBeenCalledWith("mailto:test@example.com");
  });
});
