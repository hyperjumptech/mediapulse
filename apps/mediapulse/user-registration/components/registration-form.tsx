"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";
import { filterTickers, formatTicker, type Ticker } from "@/lib/tickers";
import { useServerFunction } from "@/app/register/action/.generated/use-server-function";

type Props = {
  tickers: Ticker[];
};

const useRegistrationForm = (tickers: Ticker[]) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { fetchData, pending: isPending, data, error } = useServerFunction();

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

  useEffect(() => {
    if (data) {
      setSubmitted(true);
      toast.success(data.message);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

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
   * Submits the registration via server action.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - The form event.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTicker || !email) return;
    fetchData({
      body: {
        email,
        name: name || undefined,
        tickerSymbol: selectedTicker.KodeEmiten,
      },
      params: {},
    });
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
    isPending,
    filtered,
    handleSubmit,
    resetForm,
  };
};

/**
 * Newsletter subscription registration form.
 * Collects email, name, and ticker selection, then submits via server action.
 *
 * @param {Props} props - The component props.
 * @param {Ticker[]} props.tickers - List of available tickers.
 * @returns {JSX.Element} The registration form component.
 */
const RegistrationForm = ({ tickers }: Props) => {
  const {
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
    isPending,
    filtered,
    handleSubmit,
    resetForm,
  } = useRegistrationForm(tickers);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Subscription Confirmed!</h1>
          <p className="text-sm text-muted-foreground">
            You&rsquo;ve successfully subscribed to news for{" "}
            <strong>{selectedTicker?.KodeEmiten}</strong>.
          </p>
        </div>
        <Button variant="outline" onClick={resetForm}>
          Subscribe to another ticker
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <TrendingUp className="size-5" />
        </div>
        <h1 className="text-xl font-bold">Subscribe to MediaPulse</h1>
        <p className="text-balance text-center text-sm text-muted-foreground">
          Get the latest stock news delivered to your inbox.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name (optional)</Label>
          <Input
            id="name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ticker-search">Stock ticker</Label>
          <div ref={containerRef} className="relative">
            <Input
              id="ticker-search"
              placeholder="Search by code or company name…"
              required
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
        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={!selectedTicker || !email || isPending}
        >
          {isPending ? "Subscribing..." : "Subscribe"}
        </Button>
      </form>
      <p className="text-balance text-center text-xs text-muted-foreground">
        By subscribing, you agree to receive daily stock updates.
        <br />
        You can unsubscribe at any time.
      </p>
    </div>
  );
};

export { RegistrationForm };
