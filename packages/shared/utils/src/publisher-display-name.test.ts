import { describe, expect, it } from "vitest";
import {
  publisherNameMatchesDomain,
  sanitizePublisherDisplayName,
} from "./publisher-display-name.js";

describe("sanitizePublisherDisplayName", () => {
  it("keeps a real publisher name and collapses its whitespace", () => {
    expect(sanitizePublisherDisplayName("  The Jakarta  Post ")).toBe(
      "The Jakarta Post",
    );
  });

  it("rejects a generic placeholder site name", () => {
    expect(sanitizePublisherDisplayName("Home")).toBe("");
    expect(sanitizePublisherDisplayName("beranda")).toBe("");
    expect(sanitizePublisherDisplayName("Google News")).toBe("");
  });

  it("rejects an empty, absent, or letterless value", () => {
    expect(sanitizePublisherDisplayName("   ")).toBe("");
    expect(sanitizePublisherDisplayName(undefined)).toBe("");
    expect(sanitizePublisherDisplayName(null)).toBe("");
    expect(sanitizePublisherDisplayName("2026")).toBe("");
  });

  it("rejects a value long enough to be a headline rather than a name", () => {
    const headline = "A".repeat(81);

    expect(sanitizePublisherDisplayName(headline)).toBe("");
  });
});

describe("publisherNameMatchesDomain", () => {
  it("accepts a name that only adds spacing and casing", () => {
    expect(
      publisherNameMatchesDomain("The Jakarta Post", "thejakartapost.com"),
    ).toBe(true);
    expect(
      publisherNameMatchesDomain("Bloomberg Technoz", "bloombergtechnoz.com"),
    ).toBe(true);
    expect(
      publisherNameMatchesDomain("CNBC Indonesia", "cnbcindonesia.com"),
    ).toBe(true);
  });

  it("accepts a name for a multi-level country suffix", () => {
    expect(publisherNameMatchesDomain("Kontan", "kontan.co.id")).toBe(true);
  });

  it("rejects a name that adds or drops a word", () => {
    expect(
      publisherNameMatchesDomain(
        "Bloomberg Technology",
        "bloombergtechnoz.com",
      ),
    ).toBe(false);
    expect(publisherNameMatchesDomain("Antara", "antaranews.com")).toBe(false);
  });

  it("rejects a name for a domain with no brand token", () => {
    expect(publisherNameMatchesDomain("Anything", "not a domain")).toBe(false);
  });
});
