import { describe, expect, it } from "vitest";

import { renderNewsletterEmail } from "./index.js";

describe("renderNewsletterEmail", () => {
  it("returns html and plain text containing the title", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Hello digest",
      bodyText: "First line\nSecond",
    });
    expect(html).toContain("Hello digest");
    expect(text.toLowerCase()).toContain("hello digest");
    expect(text).toMatch(/first line/i);
  });

  it("omits manage-preferences link when preferencesUrl is not set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
    });
    expect(html).not.toMatch(/manage preferences/i);
  });

  it("includes manage-preferences link when preferencesUrl is set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
      preferencesUrl: "https://app.example.com/settings/email",
    });
    expect(html).toMatch(/manage preferences/i);
    expect(html).toContain("https://app.example.com/settings/email");
  });
});
