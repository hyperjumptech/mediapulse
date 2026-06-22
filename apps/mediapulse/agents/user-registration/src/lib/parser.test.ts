import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizeTickerSymbol,
  deriveNameFromEmailLocalPart,
  extractSenderEmail,
  extractTickerSymbol,
  extractLanguage,
  extractSubscriberName,
  extractUsableFromDisplayName,
  resolveSubscriberDisplayName,
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

  describe("extractLanguage", () => {
    it("defaults to English when no language line is present", () => {
      expect(extractLanguage(undefined)).toBe("en");
      expect(extractLanguage(null)).toBe("en");
      expect(extractLanguage("")).toBe("en");
      expect(extractLanguage("Name: Jane\nTicker: BBCA")).toBe("en");
    });

    it("parses the English code", () => {
      const body = "Name: Jane  |  Ticker: BBCA  |  Language: en  |  ---";
      expect(extractLanguage(body)).toBe("en");
    });

    it("parses the Indonesian code", () => {
      const body = "Name: Jane  |  Ticker: BBCA  |  Language: id  |  ---";
      expect(extractLanguage(body)).toBe("id");
    });

    it("accepts full language words case-insensitively", () => {
      expect(extractLanguage("Language: Indonesian")).toBe("id");
      expect(extractLanguage("Language: ENGLISH")).toBe("en");
    });

    it("parses the language from HTML body content", () => {
      const body =
        "<div>Ticker: BBCA</div><div>Language: id</div><div>---</div>";
      expect(extractLanguage(body)).toBe("id");
    });

    it("defaults to English for an unrecognized language value", () => {
      expect(extractLanguage("Language: french")).toBe("en");
    });
  });

  describe("extractSubscriberName", () => {
    it("returns null for empty or missing body", () => {
      expect(extractSubscriberName(undefined)).toBeNull();
      expect(extractSubscriberName(null)).toBeNull();
      expect(extractSubscriberName("")).toBeNull();
      expect(extractSubscriberName("   ")).toBeNull();
    });

    it("parses Name from plain multiline body", () => {
      const body = "Name: Kevin Hermawan\nTicker: BUMI\n\n---\nFooter";
      expect(extractSubscriberName(body)).toBe("Kevin Hermawan");
    });

    it("prefers Name over Subscriber Name when both appear", () => {
      const body =
        "Subscriber Name: Legacy\nName: Preferred User\nTicker: BBCA";
      expect(extractSubscriberName(body)).toBe("Preferred User");
    });

    it("parses Subscriber Name line when no Name line exists", () => {
      const body = "Ticker: TLKM\nSubscriber Name: Jane Smith\n---";
      expect(extractSubscriberName(body)).toBe("Jane Smith");
    });

    it("parses legacy single-line body with Subscriber Name before delimiter", () => {
      const body =
        "Ticker: BUMI - Bumi Resources Tbk Subscriber Name: Kevin Hermawan --- Please do not modify";
      expect(extractSubscriberName(body)).toBe("Kevin Hermawan");
    });

    it("parses Name on same line before Ticker when there are no newlines", () => {
      const body = "Prefix Name: Pat Lee Ticker: GOTO suffix";
      expect(extractSubscriberName(body)).toBe("Pat Lee");
    });

    it("parses Name from HTML body content", () => {
      const body =
        "<html><body><div>Name: HTML User</div><br/><div>Ticker: BBCA</div></body></html>";
      expect(extractSubscriberName(body)).toBe("HTML User");
    });

    it("parses Name when the body uses pipe separators (Gmail-style one line)", () => {
      const body =
        "Name: Kevin Hermawan  |  Ticker: BBCA  |  ---  |  Please do not modify the subject or content of this email before sending.";
      expect(extractSubscriberName(body)).toBe("Kevin Hermawan");
    });

    it("parses Subscriber Name when the body is one collapsed line with pipes", () => {
      const body =
        "Ticker: BUMI - PT Bumi Resources Tbk  |  Subscriber Name: Kevin Hermawan  |  ---  |  Please do not modify the subject or content of this email before sending.";
      expect(extractSubscriberName(body)).toBe("Kevin Hermawan");
    });

    it("parses Subscriber Name from simple HTML body", () => {
      const body =
        "<div>Ticker: BBCA - Bank</div><div>Subscriber Name:  Jane Doe  </div><div>---</div>";
      expect(extractSubscriberName(body)).toBe("Jane Doe");
    });

    it("stops at Ticker when Subscriber Name appears before Ticker on separate lines", () => {
      const body = [
        "Subscriber Name: Pat Lee",
        "Ticker: IBM - International Business Machines",
        "---",
        "Please do not modify the subject or content of this email before sending.",
      ].join("\n");
      expect(extractSubscriberName(body)).toBe("Pat Lee");
    });

    it("returns null when Name label is empty", () => {
      expect(extractSubscriberName("Name:\nTicker: BBCA")).toBeNull();
    });

    it("returns null when no name labels are present", () => {
      expect(extractSubscriberName("Ticker: GOTO - GoTo")).toBeNull();
      expect(extractSubscriberName(null)).toBeNull();
      expect(extractSubscriberName("")).toBeNull();
    });
  });

  describe("extractUsableFromDisplayName", () => {
    it("returns trimmed name when distinct from sender email", () => {
      expect(
        extractUsableFromDisplayName(
          "  Kevin From Header  ",
          "kevin@example.com",
        ),
      ).toBe("Kevin From Header");
    });

    it("returns null when missing, too short, equals email, or is an email string", () => {
      expect(extractUsableFromDisplayName(undefined, "a@b.co")).toBeNull();
      expect(extractUsableFromDisplayName("x", "a@b.co")).toBeNull();
      expect(extractUsableFromDisplayName("A@B.CO", "a@b.co")).toBeNull();
      expect(
        extractUsableFromDisplayName("other@example.com", "a@b.co"),
      ).toBeNull();
    });
  });

  describe("resolveSubscriberDisplayName", () => {
    const baseMsg = {
      id: "1",
      subject: null,
      receivedDateTime: "2024-01-01T00:00:00Z",
      isRead: false,
    };

    it("uses body Name when present", () => {
      const msg = {
        ...baseMsg,
        body: {
          content: "Name: Kevin Hermawan\nTicker: BUMI",
          contentType: "text",
        },
        from: {
          emailAddress: {
            address: "kevin.hermawan@gmail.com",
            name: "Gmail Name",
          },
        },
      };
      expect(
        resolveSubscriberDisplayName(msg, "kevin.hermawan@gmail.com"),
      ).toBe("Kevin Hermawan");
    });

    it("falls back to from display name when body has no name", () => {
      const msg = {
        ...baseMsg,
        body: { content: "Ticker: BBCA only", contentType: "text" },
        from: {
          emailAddress: {
            address: "john.doe@example.com",
            name: "Johnny Header",
          },
        },
      };
      expect(resolveSubscriberDisplayName(msg, "john.doe@example.com")).toBe(
        "Johnny Header",
      );
    });

    it("falls back to local-part derived name when body and header are unusable", () => {
      const msg = {
        ...baseMsg,
        body: undefined,
        from: {
          emailAddress: {
            address: "john.doe@example.com",
            name: "john.doe@example.com",
          },
        },
      };
      expect(resolveSubscriberDisplayName(msg, "john.doe@example.com")).toBe(
        "John Doe",
      );
    });
  });
});
