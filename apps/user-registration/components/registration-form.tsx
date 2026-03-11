"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import {
  filterTickers,
  formatTicker,
  buildMailtoUrl,
  type Ticker,
} from "@/lib/tickers";

type Props = {
  tickers: Ticker[];
  /** Injectable for tests — defaults to opening the mailto URL in the current tab. */
  openMailto?: (url: string) => void;
};

/**
 * Newsletter subscription registration form.
 * Collects a single ticker selection, then opens a prefilled mailto draft.
 * Accepts openMailto as a dependency injection point for testing.
 */
const RegistrationForm = ({
  tickers,
  openMailto = (url) => {
    window.location.href = url;
  },
}: Props) => {
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [open, setOpen] = useState(false);
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

  /** Selects a ticker, sets display string in the input, and closes the dropdown. */
  const handleTickerSelect = (ticker: Ticker) => {
    setSelectedTicker(ticker);
    setQuery(formatTicker(ticker));
    setOpen(false);
  };

  /** Updates search query, clears current selection, and opens the dropdown. */
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedTicker(null);
    setOpen(true);
  };

  /** Opens the prefilled mailto URL for the selected ticker. */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedTicker) return;
    openMailto(buildMailtoUrl(selectedTicker));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <a
          href="#"
          className="flex flex-col items-center gap-2 font-medium"
          tabIndex={-1}
          aria-hidden="true"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="size-5" />
          </div>
        </a>
        <h1 className="text-xl font-bold">Subscribe to MediaPulse</h1>
        <p className="text-balance text-center text-sm text-muted-foreground">
          Get the latest stock news delivered to your inbox.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ticker-search">Stock ticker</Label>
          <div ref={containerRef} className="relative">
            <Input
              id="ticker-search"
              placeholder="Search by code or company name…"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={handleQueryChange}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-haspopup="listbox"
            />

            {open && filtered.length > 0 && (
              <ul
                role="listbox"
                aria-label="Ticker options"
                className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md"
              >
                {filtered.slice(0, 50).map((t) => (
                  <li
                    key={t.KodeEmiten}
                    role="option"
                    aria-selected={selectedTicker?.KodeEmiten === t.KodeEmiten}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      selectedTicker?.KodeEmiten === t.KodeEmiten &&
                        "bg-accent",
                    )}
                    onClick={() => handleTickerSelect(t)}
                  >
                    <span className="w-16 shrink-0 font-mono font-semibold text-foreground">
                      {t.KodeEmiten}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {t.NamaEmiten}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {open && query.length > 0 && filtered.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-md">
                No tickers found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={!selectedTicker}>
          Subscribe via Email
        </Button>
      </form>

      <p className="text-balance text-center text-xs text-muted-foreground">
        This will open your email client with a pre-filled message.{" "}
        <strong>
          Please do not modify the subject or content before sending.
        </strong>
      </p>
    </div>
  );
};

export { RegistrationForm };
