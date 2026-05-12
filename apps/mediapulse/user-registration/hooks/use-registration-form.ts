import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { env } from "@mediapulse/env/app-user-registration";
import {
  filterTickers,
  formatTicker,
  buildMailtoUrl,
  type Ticker,
} from "@/lib/tickers";

/**
 * Custom hook to manage state and logic for the registration form.
 *
 * @param {Ticker[]} tickers - List of available tickers to filter.
 * @param {(url: string) => void} openMailto - Callback to open the constructed mailto URL.
 * @returns {object} The form state and event handlers.
 */
export const useRegistrationForm = (
  tickers: Ticker[],
  openMailto: (url: string) => void,
) => {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = filterTickers(tickers, query);

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
   * @param {Ticker} ticker - The selected ticker object.
   */
  const handleTickerSelect = (ticker: Ticker) => {
    setSelectedTicker(ticker);
    setQuery(formatTicker(ticker));
    setOpen(false);
  };

  /**
   * Updates search query, clears current selection, and opens the dropdown.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event.
   */
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedTicker(null);
    setOpen(true);
  };

  /**
   * Submits the registration via mailto.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!selectedTicker || !trimmedName) return;

    const mailtoUrl = buildMailtoUrl(
      selectedTicker,
      trimmedName,
      env.NEXT_PUBLIC_REGISTRATION_EMAIL,
    );

    openMailto(mailtoUrl);
    setSubmitted(true);
    toast.success(
      "Open your email app and send the draft message to finish subscribing.",
    );
  };

  const resetForm = () => {
    setSubmitted(false);
    setName("");
    setQuery("");
    setSelectedTicker(null);
  };

  return {
    name,
    setName,
    query,
    handleQueryChange,
    selectedTicker,
    handleTickerSelect,
    open,
    setOpen,
    submitted,
    containerRef,
    filtered,
    handleSubmit,
    resetForm,
  };
};
