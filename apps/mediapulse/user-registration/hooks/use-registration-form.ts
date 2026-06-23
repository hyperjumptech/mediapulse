import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  filterTickers,
  formatTicker,
  type Ticker,
  type RegistrationLanguage,
} from "@/lib/tickers";
import {
  useSubscribeMailAppModal,
  type SubmissionMode,
} from "@/hooks/use-subscribe-mail-app-modal";

/**
 * Custom hook to manage state and logic for the registration form.
 *
 * @param tickers - List of available tickers to filter.
 * @returns The form state, modal handlers, and event handlers.
 */
export const useRegistrationForm = (tickers: Ticker[]) => {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<RegistrationLanguage>("en");
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMode, setSubmissionMode] =
    useState<SubmissionMode>("mailto");
  const [confirmationEmail, setConfirmationEmailState] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = filterTickers(tickers, query);

  const completeMailAppSubmission = () => {
    setSubmissionMode("mailto");
    setSubmitted(true);
  };

  const completeEmailSubmission = (email: string) => {
    setSubmissionMode("email");
    setConfirmationEmailState(email);
    setSubmitted(true);
  };

  const {
    mailChoiceOpen,
    setMailChoiceOpen,
    confirmEmailOpen,
    setConfirmEmailOpen,
    confirmationEmail: modalConfirmationEmail,
    setConfirmationEmail,
    sendingEmail,
    mailAppOptions,
    openMailChoiceModal,
    handleSelectOutlook,
    handleSelectNativeMail,
    handleSelectOther,
    handleSendConfirmationEmail,
    resetSubscribeModals,
  } = useSubscribeMailAppModal({
    name,
    language,
    selectedTicker,
    onMailAppComplete: completeMailAppSubmission,
    onEmailComplete: completeEmailSubmission,
  });

  useEffect(() => {
    /** Closes the ticker dropdown when clicking outside the container. */
    const handleOutsideClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  /**
   * Selects a ticker, sets display string in the input, and closes the dropdown.
   *
   * @param ticker - The selected ticker object.
   */
  const handleTickerSelect = (ticker: Ticker) => {
    setSelectedTicker(ticker);
    setQuery(formatTicker(ticker));
    setOpen(false);
  };

  /**
   * Updates search query, clears current selection, and opens the dropdown.
   *
   * @param e - The change event.
   */
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedTicker(null);
    setOpen(true);
  };

  /**
   * Opens the subscribe mail-app choice modal when the form is valid.
   *
   * @param e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!selectedTicker || !trimmedName) return;

    openMailChoiceModal();
  };

  const resetForm = () => {
    setSubmitted(false);
    setSubmissionMode("mailto");
    setConfirmationEmailState("");
    setName("");
    setLanguage("en");
    setQuery("");
    setSelectedTicker(null);
    resetSubscribeModals();
  };

  return {
    name,
    setName,
    language,
    setLanguage,
    query,
    handleQueryChange,
    selectedTicker,
    handleTickerSelect,
    open,
    setOpen,
    submitted,
    submissionMode,
    confirmationEmail,
    containerRef,
    filtered,
    handleSubmit,
    resetForm,
    mailChoiceOpen,
    setMailChoiceOpen,
    confirmEmailOpen,
    setConfirmEmailOpen,
    modalConfirmationEmail,
    setConfirmationEmail,
    sendingEmail,
    mailAppOptions,
    handleSelectOutlook,
    handleSelectNativeMail,
    handleSelectOther,
    handleSendConfirmationEmail,
  };
};
