import { describe, expect, it } from "vitest";
import { buildVCard } from "./build-vcard.js";

describe("buildVCard", () => {
  it("emits a valid vCard 3.0 with the given name and email", () => {
    const card = buildVCard({
      name: "CEO (Chief Email Officer) - MediaPulse",
      email: "mediapulse@example.com",
    });

    expect(card).toContain("BEGIN:VCARD");
    expect(card).toContain("VERSION:3.0");
    expect(card).toContain("FN:CEO (Chief Email Officer) - MediaPulse");
    expect(card).toContain("ORG:MediaPulse");
    expect(card).toContain("EMAIL;TYPE=INTERNET:mediapulse@example.com");
    expect(card).toContain("END:VCARD");
  });

  it("uses CRLF line endings", () => {
    const card = buildVCard({ name: "Test", email: "test@example.com" });

    expect(card).toContain("\r\n");
    expect(card.split("\r\n").length).toBeGreaterThan(1);
  });
});
