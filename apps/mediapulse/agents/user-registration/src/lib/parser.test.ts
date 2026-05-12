import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizeTickerSymbol,
  deriveNameFromEmailLocalPart,
  extractSenderEmail,
  extractSubscriberNameFromBody,
  extractTickerSymbol,
} from "../lib/parser";

describe("Parser Helpers", () => {
  describe("normalizeEmail", () => {
    it("normalizes email addresses correctly", () => {
      expect(normalizeEmail(" TEST@Example.com ")).toBe("test@example.com");
      expect(normalizeEmail("user.name+label@example.co.uk")).toBe(
        "user.name+label@example.co.uk",
      );
    });
  });

  describe("normalizeTickerSymbol", () => {
    it("normalizes ticker symbols correctly", () => {
      expect(normalizeTickerSymbol(" bbca ")).toBe("BBCA");
      expect(normalizeTickerSymbol("aapl")).toBe("AAPL");
    });
  });

  describe("deriveNameFromEmailLocalPart", () => {
    it("derives names from standard local parts", () => {
      expect(deriveNameFromEmailLocalPart("john.doe@example.com")).toBe(
        "John Doe",
      );
      expect(deriveNameFromEmailLocalPart("jane_smith123@example.com")).toBe(
        "Jane Smith123",
      );
      expect(deriveNameFromEmailLocalPart("alice-bob@example.com")).toBe(
        "Alice Bob",
      );
      expect(deriveNameFromEmailLocalPart("simple@example.com")).toBe("Simple");
    });

    it("returns null for invalid inputs", () => {
      expect(deriveNameFromEmailLocalPart("")).toBeNull();
      expect(deriveNameFromEmailLocalPart("invalid-email")).toBeNull();
      expect(deriveNameFromEmailLocalPart("@no-local-part.com")).toBeNull();
    });
  });

  describe("extractSenderEmail", () => {
    it("extracts email from Graph message .from property", () => {
      const msg = {
        id: "1",
        subject: null,
        receivedDateTime: "2024-01-01T00:00:00Z",
        isRead: false,
        from: {
          emailAddress: { address: "User@Example.com", name: "User" },
        },
      };
      expect(extractSenderEmail(msg)).toBe("user@example.com");
    });

    it("returns null when from address is absent", () => {
      const msg = {
        id: "1",
        subject: null,
        receivedDateTime: "2024-01-01T00:00:00Z",
        isRead: false,
        from: undefined,
      };
      expect(extractSenderEmail(msg)).toBeNull();
    });

    it("returns null if no email address can be found", () => {
      expect(
        extractSenderEmail({
          id: "2",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
          from: undefined,
        }),
      ).toBeNull();
      expect(
        extractSenderEmail({
          id: "3",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
          from: { emailAddress: { name: "Only Name" } },
        }),
      ).toBeNull();
    });

    it("returns null if email format is invalid", () => {
      expect(
        extractSenderEmail({
          id: "4",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
          from: { emailAddress: { address: "invalid-email" } },
        }),
      ).toBeNull();

      expect(
        extractSenderEmail({
          id: "5",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
          from: { emailAddress: { address: "@nodomain.com" } },
        }),
      ).toBeNull();

      expect(
        extractSenderEmail({
          id: "6",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
          from: { emailAddress: { address: "name@domain" } },
        }),
      ).toBeNull();
    });
  });

  describe("extractSubscriberNameFromBody", () => {
    it("parses Subscriber Name on its own line", () => {
      const body = [
        "Ticker: BUMI - PT Bumi Resources Tbk",
        "Subscriber Name: Kevin Hermawan",
        "",
        "---",
        "Please do not modify the subject or content of this email before sending.",
      ].join("\n");
      expect(extractSubscriberNameFromBody(body)).toBe("Kevin Hermawan");
    });

    it("parses Subscriber Name when the body uses pipe separators (Gmail-style one line)", () => {
      const body = [
        "Ticker: BUMI - PT Bumi Resources Tbk",
        "Subscriber Name: Kevin Hermawan",
        "---",
        "Please do not modify the subject or content of this email before sending.",
      ].join("  |  ");
      expect(extractSubscriberNameFromBody(body)).toBe("Kevin Hermawan");
    });

    it("parses Subscriber Name when the body is one collapsed line", () => {
      const body =
        "Ticker: BUMI - PT Bumi Resources Tbk  |  Subscriber Name: Kevin Hermawan  |  ---  |  Please do not modify the subject or content of this email before sending.";
      expect(extractSubscriberNameFromBody(body)).toBe("Kevin Hermawan");
    });

    it("parses Subscriber Name from simple HTML body", () => {
      const body =
        "<div>Ticker: BBCA - Bank</div><div>Subscriber Name:  Jane Doe  </div><div>---</div>";
      expect(extractSubscriberNameFromBody(body)).toBe("Jane Doe");
    });

    it("stops at Ticker: when Subscriber Name appears before Ticker", () => {
      const body = [
        "Subscriber Name: Pat Lee",
        "Ticker: IBM - International Business Machines",
        "---",
        "Please do not modify the subject or content of this email before sending.",
      ].join("\n");
      expect(extractSubscriberNameFromBody(body)).toBe("Pat Lee");
    });

    it("returns null when Subscriber Name is absent", () => {
      expect(extractSubscriberNameFromBody("Ticker: GOTO - GoTo")).toBeNull();
      expect(extractSubscriberNameFromBody(null)).toBeNull();
      expect(extractSubscriberNameFromBody("")).toBeNull();
    });
  });

  describe("extractTickerSymbol", () => {
    it("extracts ticker from standard subject", () => {
      const subject = "[MediaPulse] Newsletter Subscription - BBCA";
      expect(extractTickerSymbol(subject, null)).toBe("BBCA");
    });

    it("extracts ticker with varying subject white-space", () => {
      const subject = "Newsletter Subscription -  aapl  ";
      expect(extractTickerSymbol(subject, undefined)).toBe("AAPL");
    });

    it("falls back to body structured line if subject is altered", () => {
      const subject = "I want to subscribe";
      const body = "Hello,\n\nTicker: GOTO - GoTo Gojek Tokopedia\nThanks!";
      expect(extractTickerSymbol(subject, body)).toBe("GOTO");
    });

    it("handles loose body match if necessary", () => {
      const body = "ticker:msft";
      expect(extractTickerSymbol(null, body)).toBe("MSFT");
    });

    it("returns null if neither subject nor body contains a valid ticker", () => {
      expect(
        extractTickerSymbol("Random email", "Just saying hello"),
      ).toBeNull();
      expect(extractTickerSymbol(null, null)).toBeNull();
    });
  });
});
