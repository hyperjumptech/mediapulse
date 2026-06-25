import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { env } from "@mediapulse/env/app-user-registration";
import {
  detectMailPlatform,
  getMailAppChoiceOptions,
  type MailAppChoiceOption,
  type MailPlatform,
} from "@/lib/detect-mail-platform";
import {
  buildMailtoUrl,
  buildOutlookComposeUrl,
  openMailClientUrl,
} from "@/lib/mail-app-urls";
import type { RegistrationLanguage, Ticker } from "@/lib/tickers";

export type SubmissionMode = "mailto" | "email";

type UseSubscribeMailAppModalParams = {
  name: string;
  language: RegistrationLanguage;
  selectedTicker: Ticker | null;
  onMailAppComplete: () => void;
  onEmailComplete: (email: string) => void;
  openMailClientUrlFn?: typeof openMailClientUrl;
  fetchConfirmRequest?: typeof fetchConfirmRequestDefault;
  detectPlatform?: (userAgent: string) => MailPlatform;
};

/**
 * Posts a web signup confirmation email request to the local API route.
 *
 * @param payload - Signup fields for the server route.
 * @returns Parsed API response.
 */
export const fetchConfirmRequestDefault = async (payload: {
  email: string;
  name: string;
  tickerSymbol: string;
  language: RegistrationLanguage;
}): Promise<{ ok: true }> => {
  const response = await fetch("/api/confirm/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Confirm request failed");
  }

  return (await response.json()) as { ok: true };
};

/**
 * Manages the two-step subscribe modal flow: mail-app choice, then optional email confirmation.
 *
 * @param params - Form values and completion callbacks.
 * @returns Modal state and handlers for the registration form.
 */
export const useSubscribeMailAppModal = ({
  name,
  language,
  selectedTicker,
  onMailAppComplete,
  onEmailComplete,
  openMailClientUrlFn = openMailClientUrl,
  fetchConfirmRequest = fetchConfirmRequestDefault,
  detectPlatform = detectMailPlatform,
}: UseSubscribeMailAppModalParams) => {
  const [mailChoiceOpen, setMailChoiceOpen] = useState(false);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [platform, setPlatform] = useState<MailPlatform>("other");

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, [detectPlatform]);

  const mailAppOptions: MailAppChoiceOption[] = useMemo(
    () => getMailAppChoiceOptions(platform),
    [platform],
  );

  /**
   * Opens the first modal when the registration form is submitted.
   */
  const openMailChoiceModal = () => {
    if (!selectedTicker || !name.trim()) {
      return;
    }
    setMailChoiceOpen(true);
  };

  /**
   * Opens an Outlook compose draft and completes the mail-app path.
   */
  const handleSelectOutlook = () => {
    if (!selectedTicker) return;

    openMailClientUrlFn(
      buildOutlookComposeUrl(
        selectedTicker,
        name,
        language,
        env.NEXT_PUBLIC_REGISTRATION_EMAIL,
        { userAgent: navigator.userAgent },
      ),
    );
    setMailChoiceOpen(false);
    onMailAppComplete();
    toast.success(
      "Open Outlook and send the draft message to finish subscribing.",
    );
  };

  /**
   * Opens the default mailto draft and completes the mail-app path.
   */
  const handleSelectNativeMail = () => {
    if (!selectedTicker) return;

    openMailClientUrlFn(
      buildMailtoUrl(
        selectedTicker,
        name,
        language,
        env.NEXT_PUBLIC_REGISTRATION_EMAIL,
      ),
    );
    setMailChoiceOpen(false);
    onMailAppComplete();
    toast.success(
      "Open your email app and send the draft message to finish subscribing.",
    );
  };

  /**
   * Opens the second modal for the email confirmation path.
   */
  const handleSelectOther = () => {
    setMailChoiceOpen(false);
    setConfirmEmailOpen(true);
  };

  /**
   * Opens the email confirmation modal when the mail-app path did not launch.
   */
  const openEmailConfirmationFallback = () => {
    setConfirmEmailOpen(true);
  };

  /**
   * Sends the confirmation email via the server route.
   */
  const handleSendConfirmationEmail = async () => {
    const trimmedEmail = confirmationEmail.trim().toLowerCase();
    if (!selectedTicker || !trimmedEmail || !name.trim()) {
      return;
    }

    setSendingEmail(true);
    try {
      await fetchConfirmRequest({
        email: trimmedEmail,
        name: name.trim(),
        tickerSymbol: selectedTicker.KodeEmiten,
        language,
      });
      setConfirmEmailOpen(false);
      setConfirmationEmail("");
      onEmailComplete(trimmedEmail);
      toast.success("Check your inbox for the confirmation link.");
    } catch {
      toast.error("Could not send the confirmation email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  const resetSubscribeModals = () => {
    setMailChoiceOpen(false);
    setConfirmEmailOpen(false);
    setConfirmationEmail("");
    setSendingEmail(false);
  };

  return {
    mailChoiceOpen,
    setMailChoiceOpen,
    confirmEmailOpen,
    setConfirmEmailOpen,
    confirmationEmail,
    setConfirmationEmail,
    sendingEmail,
    mailAppOptions,
    openMailChoiceModal,
    handleSelectOutlook,
    handleSelectNativeMail,
    handleSelectOther,
    openEmailConfirmationFallback,
    handleSendConfirmationEmail,
    resetSubscribeModals,
  };
};
