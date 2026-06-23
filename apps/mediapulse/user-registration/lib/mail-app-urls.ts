import { detectIsIosUserAgent } from "@/lib/detect-mail-platform";
import type { RegistrationLanguage, Ticker } from "@/lib/tickers";
import { MAILTO_BODY_SECTION_SEPARATOR } from "@/lib/tickers";

export type OutlookComposeUrlOptions = {
  userAgent?: string;
};

type MailDraftInput = {
  ticker: Ticker;
  name: string;
  language: RegistrationLanguage;
  registrationEmail: string;
};

/**
 * Builds the shared subject and body used by mailto and Outlook compose URLs.
 *
 * @param input - Subscription draft fields.
 * @returns Subject line and body text.
 */
export const buildRegistrationMailDraft = (
  input: MailDraftInput,
): { subject: string; body: string } => {
  const subject = `[MediaPulse] Newsletter Subscription - ${input.ticker.KodeEmiten}`;
  const body = [
    `Name: ${input.name.trim()}`,
    `Ticker: ${input.ticker.KodeEmiten}`,
    `Language: ${input.language}`,
    "---",
    "Please do not modify the subject or content of this email before sending.",
  ].join(MAILTO_BODY_SECTION_SEPARATOR);

  return { subject, body };
};

/**
 * Builds a mailto URL for newsletter subscription with a fixed subject and body.
 *
 * @param ticker - Ticker the user wants to subscribe to.
 * @param name - Subscriber display name.
 * @param language - Preferred newsletter language code.
 * @param registrationEmail - Target inbox for registration.
 * @returns Encoded mailto URL string.
 */
export const buildMailtoUrl = (
  ticker: Ticker,
  name: string,
  language: RegistrationLanguage,
  registrationEmail: string = "mediapulse@hyperjump.tech",
): string => {
  const { subject, body } = buildRegistrationMailDraft({
    ticker,
    name,
    language,
    registrationEmail,
  });

  return `mailto:${registrationEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
};

/**
 * Builds an Outlook compose URL for the same registration draft as mailto.
 *
 * @param ticker - Ticker the user wants to subscribe to.
 * @param name - Subscriber display name.
 * @param language - Preferred newsletter language code.
 * @param registrationEmail - Target inbox for registration.
 * @param options - Optional client hints for platform-specific Outlook paths.
 * @returns Encoded ms-outlook compose URL string.
 */
export const buildOutlookComposeUrl = (
  ticker: Ticker,
  name: string,
  language: RegistrationLanguage,
  registrationEmail: string = "mediapulse@hyperjump.tech",
  options: OutlookComposeUrlOptions = {},
): string => {
  const { subject, body } = buildRegistrationMailDraft({
    ticker,
    name,
    language,
    registrationEmail,
  });

  const params = new URLSearchParams({
    to: registrationEmail,
    subject,
    body,
  });

  const composePath =
    options.userAgent && detectIsIosUserAgent(options.userAgent)
      ? "emails/new"
      : "compose";

  return `ms-outlook://${composePath}?${params.toString()}`;
};

/**
 * Opens a URL in the browser, typically a mail client handler.
 *
 * @param url - Mail client URL to open.
 * @param openUrl - Injectable opener for tests.
 */
export const openMailClientUrl = (
  url: string,
  openUrl: (target: string) => void = (target) => {
    window.location.href = target;
  },
): void => {
  openUrl(url);
};
