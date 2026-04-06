/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { buildHermesAdminPasswordResetEmailContent } from "./hermes-admin-password-reset-email-content";

describe("buildHermesAdminPasswordResetEmailContent", () => {
  it("includes the reset URL in text and html", () => {
    const url = "http://localhost:3001/reset-password?token=abc";
    const { subject, text, html } =
      buildHermesAdminPasswordResetEmailContent(url);
    expect(subject).toContain("Hermes");
    expect(text).toContain(url);
    expect(html).toContain(`href="${url}"`);
  });
});
