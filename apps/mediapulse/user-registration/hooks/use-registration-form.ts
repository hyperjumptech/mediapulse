import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { filterTickers, formatTicker, type Ticker } from "@/lib/tickers";

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
  const [email, setEmail] = useState("");
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
    if (!selectedTicker || !email) return;

    const subject = encodeURIComponent(
      `[MediaPulse] Newsletter Subscription - ${selectedTicker.KodeEmiten}`,
    );
    const body = encodeURIComponent(
      `I would like to subscribe to updates for ${selectedTicker.KodeEmiten} - ${selectedTicker.NamaEmiten}.\n\nName: ${name || "Not provided"}\nEmail: ${email}\nReference: ${Date.now()}`,
    );

    const mailtoUrl = `mailto:registration@mediapulse.example?subject=${subject}&body=${body}`;
    openMailto(mailtoUrl);
    setSubmitted(true);
    toast.success("Please check your email client to complete registration.");
  };

  const resetForm = () => {
    setSubmitted(false);
    setEmail("");
    setName("");
    setQuery("");
    setSelectedTicker(null);
  };

  return {
    email,
    setEmail,
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
