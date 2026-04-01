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
});
