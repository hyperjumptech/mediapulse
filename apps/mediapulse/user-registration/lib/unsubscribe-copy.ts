import type { UnsubscribeStatus } from "@/lib/unsubscribe-api";

export type UnsubscribeLanguage = "en" | "id";

/**
 * Narrows an arbitrary query value to a supported language, defaulting to English.
 *
 * @param value - Raw `lang` query parameter.
 * @returns A supported language code.
 */
export const toUnsubscribeLanguage = (
  value: string | null | undefined,
): UnsubscribeLanguage => (value === "id" ? "id" : "en");

type ConfirmCopy = {
  title: string;
  prompt: (symbol: string) => string;
  confirmButton: string;
  confirming: string;
  expired: string;
  invalid: string;
  outcome: (status: UnsubscribeStatus, symbol?: string) => string;
};

const withSymbol = (symbol: string | undefined, fallback: string): string =>
  symbol ?? fallback;

const COPY: Record<UnsubscribeLanguage, ConfirmCopy> = {
  en: {
    title: "Unsubscribe?",
    prompt: (symbol) =>
      `You'll stop receiving ${symbol} updates. This can't be undone from this link.`,
    confirmButton: "Confirm unsubscribe",
    confirming: "Unsubscribing…",
    expired:
      "This unsubscribe link has expired. Please contact support or reply to the email.",
    invalid:
      "This unsubscribe link is invalid. Please contact support or reply to the email.",
    outcome: (status, symbol) => {
      const label = withSymbol(symbol, "these");
      if (status === "unsubscribed") {
        return `You've been unsubscribed from ${label} updates.`;
      }
      if (status === "already_unsubscribed") {
        return `You're already unsubscribed from ${label} updates.`;
      }
      if (status === "not_found") {
        return "We couldn't find this subscription. It may have already been removed.";
      }
      if (status === "expired") {
        return "This unsubscribe link has expired. Please contact support or reply to the email.";
      }
      return "Unsubscribe is temporarily unavailable. Please try again later.";
    },
  },
  id: {
    title: "Berhenti berlangganan?",
    prompt: (symbol) =>
      `Anda akan berhenti menerima pembaruan ${symbol}. Tindakan ini tidak dapat dibatalkan dari tautan ini.`,
    confirmButton: "Konfirmasi berhenti berlangganan",
    confirming: "Memproses…",
    expired:
      "Tautan berhenti berlangganan ini telah kedaluwarsa. Silakan hubungi dukungan atau balas email.",
    invalid:
      "Tautan berhenti berlangganan ini tidak valid. Silakan hubungi dukungan atau balas email.",
    outcome: (status, symbol) => {
      const label = withSymbol(symbol, "ini");
      if (status === "unsubscribed") {
        return `Anda telah berhenti berlangganan pembaruan ${label}.`;
      }
      if (status === "already_unsubscribed") {
        return `Anda sudah berhenti berlangganan pembaruan ${label}.`;
      }
      if (status === "not_found") {
        return "Kami tidak dapat menemukan langganan ini. Mungkin sudah dihapus.";
      }
      if (status === "expired") {
        return "Tautan berhenti berlangganan ini telah kedaluwarsa. Silakan hubungi dukungan atau balas email.";
      }
      return "Berhenti berlangganan sedang tidak tersedia. Silakan coba lagi nanti.";
    },
  },
};

/**
 * Returns the unsubscribe UI copy for a language.
 *
 * @param language - Supported language code.
 * @returns The copy bundle.
 */
export const getUnsubscribeCopy = (
  language: UnsubscribeLanguage,
): ConfirmCopy => COPY[language];
