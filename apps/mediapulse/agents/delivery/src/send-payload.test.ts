import { describe, expect, it } from "vitest";

import { buildSendPayload } from "./send-payload.js";

const baseInput = {
  from: '"MediaPulse" <ceo@mediapulse.example.com>',
  to: "reader@example.com",
  subject: "TLKM Pulse: Getting to know Telkom Indonesia",
  html: "<p>h</p>",
  text: "t",
  oneClickUnsubscribeUrl:
    "https://register.example.com/api/unsubscribe?token=x",
  messageId: "<d1w.a.b@mediapulse.example.com>",
};

describe("buildSendPayload", () => {
  it("adds the unsubscribe and Message-ID headers", () => {
    const payload = buildSendPayload({
      ...baseInput,
      config: {
        send: { includeHtml: true, includeText: true },
        resend: { from: "ceo@mediapulse.example.com" },
      },
    });

    expect(payload).toEqual({
      from: baseInput.from,
      to: "reader@example.com",
      subject: baseInput.subject,
      html: "<p>h</p>",
      text: "t",
      headers: {
        "List-Unsubscribe":
          "<https://register.example.com/api/unsubscribe?token=x>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Message-ID": "<d1w.a.b@mediapulse.example.com>",
      },
    });
  });

  it("leaves out disabled body parts and forwards reply-to and tags", () => {
    const payload = buildSendPayload({
      ...baseInput,
      config: {
        send: { includeHtml: false, includeText: true },
        resend: {
          from: "ceo@mediapulse.example.com",
          replyTo: "mediapulse@example.com",
          tags: [{ name: "kind", value: "welcome" }],
        },
      },
    });

    expect(payload).not.toHaveProperty("html");
    expect(payload).toMatchObject({
      text: "t",
      replyTo: "mediapulse@example.com",
      tags: [{ name: "kind", value: "welcome" }],
    });
  });
});
