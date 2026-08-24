import { describe, expect, it } from "vitest";

import {
  formatNewsletterEmailSubject,
  parseNewsletterEmailSubject,
} from "./newsletter-email-subject.js";

describe("formatNewsletterEmailSubject", () => {
  it("prefixes a plain title with the uppercased ticker symbol", () => {
    // Act
    const subject = formatNewsletterEmailSubject(
      "ihsg",
      "Market cap up Rp 717 trillion as IHSG hits 6,008",
    );

    // Assert
    expect(subject).toBe(
      "IHSG Pulse: Market cap up Rp 717 trillion as IHSG hits 6,008",
    );
  });

  it("returns the title unchanged when already formatted", () => {
    // Setup
    const formatted = "BBCA Pulse: Banking rally lifts sector sentiment";

    // Act
    const subject = formatNewsletterEmailSubject("BBCA", formatted);

    // Assert
    expect(subject).toBe(formatted);
  });

  it("normalizes legacy bracket subjects to the unbracketed format", () => {
    // Act
    const subject = formatNewsletterEmailSubject(
      "BBCA",
      "[BBCA] Pulse: Banking rally lifts sector sentiment",
    );

    // Assert
    expect(subject).toBe("BBCA Pulse: Banking rally lifts sector sentiment");
  });

  it("returns the trimmed title when ticker symbol is empty", () => {
    // Act
    const subject = formatNewsletterEmailSubject("", "  Plain headline  ");

    // Assert
    expect(subject).toBe("Plain headline");
  });

  it("uses a default title when title is empty but symbol is present", () => {
    // Act
    const subject = formatNewsletterEmailSubject("BBCA", "   ");

    // Assert
    expect(subject).toBe("BBCA Pulse: Today's issue");
  });
});

describe("parseNewsletterEmailSubject", () => {
  it("extracts ticker symbol and plain title from a formatted subject", () => {
    // Act
    const parsed = parseNewsletterEmailSubject(
      "IHSG Pulse: Market cap up Rp 717 trillion as IHSG hits 6,008",
    );

    // Assert
    expect(parsed).toEqual({
      tickerSymbol: "IHSG",
      title: "Market cap up Rp 717 trillion as IHSG hits 6,008",
    });
  });

  it("parses legacy bracket subjects for backward compatibility", () => {
    // Act
    const parsed = parseNewsletterEmailSubject(
      "[IHSG] Pulse: Market cap up Rp 717 trillion as IHSG hits 6,008",
    );

    // Assert
    expect(parsed).toEqual({
      tickerSymbol: "IHSG",
      title: "Market cap up Rp 717 trillion as IHSG hits 6,008",
    });
  });

  it("returns legacy subjects unchanged with null ticker symbol", () => {
    // Act
    const parsed = parseNewsletterEmailSubject(
      "Market cap up Rp 717 trillion as IHSG hits 6,008",
    );

    // Assert
    expect(parsed).toEqual({
      tickerSymbol: null,
      title: "Market cap up Rp 717 trillion as IHSG hits 6,008",
    });
  });

  it("round-trips with formatNewsletterEmailSubject", () => {
    // Setup
    const title = "Energy stocks rally on policy shift";

    // Act
    const formatted = formatNewsletterEmailSubject("enrg", title);
    const parsed = parseNewsletterEmailSubject(formatted);

    // Assert
    expect(parsed).toEqual({ tickerSymbol: "ENRG", title });
  });
});
