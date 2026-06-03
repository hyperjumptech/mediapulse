import { describe, expect, it } from "vitest";
import {
  formatResendSender,
  MEDIAPULSE_SENDER_NAME,
} from "./format-resend-sender.js";

describe("formatResendSender", () => {
  it("wraps a bare address with the default branded display name (double-quoted)", () => {
    const result = formatResendSender("hello@example.com");

    expect(result).toBe(`"${MEDIAPULSE_SENDER_NAME}" <hello@example.com>`);
  });

  it("wraps a bare address with a custom display name", () => {
    const result = formatResendSender("hello@example.com", "Acme Newsletter");

    expect(result).toBe('"Acme Newsletter" <hello@example.com>');
  });

  it("returns the address unchanged when it already contains a display name", () => {
    const already =
      '"CEO (Chief Email Officer) - MediaPulse" <hello@example.com>';
    const result = formatResendSender(already);

    expect(result).toBe(already);
  });
});
