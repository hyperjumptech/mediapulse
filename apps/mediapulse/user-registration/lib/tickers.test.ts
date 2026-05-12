/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  filterTickers,
  formatTicker,
  buildMailtoUrl,
  type Ticker,
} from "./tickers";

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

describe("filterTickers", () => {
  it("returns all tickers when query is empty", () => {
    // Act
    const result = filterTickers(sampleTickers, "");

    // Assert
    expect(result).toEqual(sampleTickers);
  });

  it("filters by ticker code case-insensitively", () => {
    // Act
    const result = filterTickers(sampleTickers, "bbca");

    // Assert
    expect(result).toHaveLength(1);
    expect(result.at(0)?.KodeEmiten).toBe("BBCA");
  });

  it("filters by company name case-insensitively", () => {
    // Act
    const result = filterTickers(sampleTickers, "bank");

    // Assert
    expect(result).toHaveLength(1);
    expect(result.at(0)?.NamaEmiten).toBe("Bank Central Asia Tbk");
  });

  it("returns empty array when no ticker matches the query", () => {
    // Act
    const result = filterTickers(sampleTickers, "xyz999");

    // Assert
    expect(result).toHaveLength(0);
  });

  it("returns multiple matches when query appears in several entries", () => {
    // Act
    const result = filterTickers(sampleTickers, "tbk");

    // Assert
    expect(result).toHaveLength(3);
  });

  it("trims whitespace from query before matching", () => {
    // Act
    const result = filterTickers(sampleTickers, "  TLKM  ");

    // Assert
    expect(result).toHaveLength(1);
    expect(result.at(0)?.KodeEmiten).toBe("TLKM");
  });

  it("returns empty array when tickers list is empty", () => {
    // Act
    const result = filterTickers([], "BBCA");

    // Assert
    expect(result).toHaveLength(0);
  });
});

describe("formatTicker", () => {
  it("formats ticker as CODE - Name", () => {
    // Setup
    const ticker: Ticker = {
      KodeEmiten: "BBCA",
      NamaEmiten: "Bank Central Asia Tbk",
    };

    // Act
    const result = formatTicker(ticker);

    // Assert
    expect(result).toBe("BBCA - Bank Central Asia Tbk");
  });
});

describe("buildMailtoUrl", () => {
  const ticker: Ticker = {
    KodeEmiten: "BBCA",
    NamaEmiten: "Bank Central Asia Tbk",
  };
  const EXPECTED_REG_EMAIL = "mediapulse@hyperjump.tech";

  it("targets the default registration email", () => {
    // Act
    const url = buildMailtoUrl(ticker, "Jane Doe");

    // Assert
    expect(url.startsWith(`mailto:${EXPECTED_REG_EMAIL}`)).toBe(true);
  });

  it("includes encoded subject with ticker code", () => {
    // Setup
    const t: Ticker = {
      KodeEmiten: "TLKM",
      NamaEmiten: "Telkom Indonesia Tbk",
    };

    // Act
    const url = buildMailtoUrl(t, "Jane Doe");

    // Assert
    expect(url).toContain("subject=");
    expect(url).toContain(encodeURIComponent("TLKM"));
  });

  it("includes Name and Ticker code lines in the encoded body", () => {
    // Setup
    const t: Ticker = {
      KodeEmiten: "AADI",
      NamaEmiten: "PT Adaro Andalan Indonesia Tbk",
    };

    // Act
    const url = buildMailtoUrl(t, "Jane Doe");

    // Assert
    expect(url).toContain(encodeURIComponent("Name: Jane Doe"));
    expect(url).toContain(encodeURIComponent("Ticker: AADI"));
    expect(url).not.toContain(
      encodeURIComponent("Ticker: AADI - PT Adaro Andalan Indonesia Tbk"),
    );
    expect(url).not.toContain(encodeURIComponent("Subscriber Name:"));
    expect(url).not.toContain(encodeURIComponent("Subscriber Email:"));
  });
});
