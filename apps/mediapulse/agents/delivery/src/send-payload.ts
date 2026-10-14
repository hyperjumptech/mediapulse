import type { DeliveryConfig } from "./config-schema.js";
import type { SendEmailPayload } from "./send-with-resend-retry.js";

export type BuildSendPayloadInput = {
  config: Pick<DeliveryConfig, "send" | "resend">;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  oneClickUnsubscribeUrl: string;
  messageId: string;
};

export const buildSendPayload = ({
  config,
  from,
  to,
  subject,
  html,
  text,
  oneClickUnsubscribeUrl,
  messageId,
}: BuildSendPayloadInput): SendEmailPayload => ({
  from,
  to,
  subject,
  ...(config.send.includeHtml ? { html } : {}),
  ...(config.send.includeText ? { text } : {}),
  ...(config.resend.replyTo !== undefined
    ? { replyTo: config.resend.replyTo }
    : {}),
  ...(config.resend.tags !== undefined && config.resend.tags.length > 0
    ? { tags: config.resend.tags }
    : {}),
  headers: {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "Message-ID": messageId,
  },
});
