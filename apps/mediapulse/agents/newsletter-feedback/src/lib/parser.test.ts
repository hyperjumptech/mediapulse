/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  extractInReplyToMessageId,
  extractSenderEmail,
  isNewsletterReply,
  normalizeEmail,
  stripQuotedReply,
} from "./parser.js";

const makeMessage = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "msg-1",
    subject: "Re: hi",
    receivedDateTime: "2024-01-01T00:00:00Z",
    isRead: false,
    from: { emailAddress: { address: "Reader@Example.com" } },
    ...overrides,
  }) as never;

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Reader@Example.COM ")).toBe("reader@example.com");
  });
});

describe("extractSenderEmail", () => {
  it("returns the normalized sender", () => {
    expect(extractSenderEmail(makeMessage())).toBe("reader@example.com");
  });

  it("returns null when the address is missing or invalid", () => {
    expect(
      extractSenderEmail(
        makeMessage({ from: { emailAddress: { address: "" } } }),
      ),
    ).toBeNull();
    expect(
      extractSenderEmail(
        makeMessage({ from: { emailAddress: { address: "nope" } } }),
      ),
    ).toBeNull();
  });
});

describe("extractInReplyToMessageId", () => {
  it("prefers In-Reply-To", () => {
    const message = makeMessage({
      internetMessageHeaders: [
        { name: "In-Reply-To", value: "<a@x>" },
        { name: "References", value: "<b@x> <c@x>" },
      ],
    });

    expect(extractInReplyToMessageId(message)).toBe("<a@x>");
  });

  it("falls back to the last References id", () => {
    const message = makeMessage({
      internetMessageHeaders: [{ name: "References", value: "<b@x> <c@x>" }],
    });

    expect(extractInReplyToMessageId(message)).toBe("<c@x>");
  });

  it("returns null when no correlation header is present", () => {
    expect(extractInReplyToMessageId(makeMessage())).toBeNull();
  });
});

describe("isNewsletterReply", () => {
  it("recognizes a self-describing newsletter Message-ID", () => {
    expect(
      isNewsletterReply(
        "<nl.11111111-1111-4111-a111-111111111111.22222222-2222-4222-a222-222222222222@mp>",
      ),
    ).toBe(true);
  });

  it("rejects unrelated message ids", () => {
    expect(isNewsletterReply("<random@mail>")).toBe(false);
    expect(isNewsletterReply(null)).toBe(false);
  });
});

describe("stripQuotedReply", () => {
  it("drops quoted lines and the original message block", () => {
    const body = [
      "Thanks, this was great!",
      "",
      "On Mon, Jan 1, 2024 at 9:00 AM MediaPulse <news@mp> wrote:",
      "> Here is your newsletter",
      "> more quoted text",
    ].join("\n");

    expect(stripQuotedReply(body)).toBe("Thanks, this was great!");
  });

  it("returns the trimmed body when there is no quoted section", () => {
    expect(stripQuotedReply("Just a quick note")).toBe("Just a quick note");
  });
});
