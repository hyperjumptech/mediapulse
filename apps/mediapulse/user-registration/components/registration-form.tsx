"use client";

import * as React from "react";
import { TrendingUp, Mail } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import {
  type Ticker,
  type RegistrationLanguage,
  REGISTRATION_LANGUAGE_OPTIONS,
} from "@/lib/tickers";
import { useRegistrationForm } from "@/hooks/use-registration-form";
import { env } from "@mediapulse/env/app-user-registration";
import { buildVCard } from "@workspace/utils/build-vcard";
import { SubscribeMailAppModal } from "@/components/subscribe-mail-app-modal";
import { SendConfirmationEmailModal } from "@/components/send-confirmation-email-modal";

const MEDIAPULSE_SENDER_NAME = "CEO (Chief Email Officer) - MediaPulse";

/**
 * Downloads the MediaPulse vCard contact file in the browser.
 */
function downloadVCard(): void {
  const vcf = buildVCard({
    name: MEDIAPULSE_SENDER_NAME,
    email: env.NEXT_PUBLIC_REGISTRATION_EMAIL,
  });
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "MediaPulse.vcf";
  anchor.click();
  URL.revokeObjectURL(url);
}

type Props = {
  tickers: Ticker[];
};

/**
 * Newsletter subscription registration form.
 * Collects name and ticker selection, then opens mail-app choice or email confirmation modals.
 *
 * @param props - The component props.
 * @param props.tickers - List of available tickers.
 * @returns The registration form component.
 */
const RegistrationForm = ({ tickers }: Props) => {
  const {
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
    openEmailConfirmationFallback,
    handleSendConfirmationEmail,
  } = useRegistrationForm(tickers);

  if (submitted) {
    if (submissionMode === "email") {
      return (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-8" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <strong>{confirmationEmail}</strong>. Click it to finish
              subscribing for <strong>{selectedTicker?.KodeEmiten}</strong>.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetForm}>
            Subscribe to another ticker
          </Button>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-8" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Almost done</h1>
            <p className="text-sm text-muted-foreground">
              Tap <strong>Send</strong> on the draft in your email app to
              subscribe for <strong>{selectedTicker?.KodeEmiten}</strong>.
            </p>
          </div>
          <div className="w-full rounded-lg border bg-muted/30 px-4 py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Save MediaPulse to your contacts so newsletters land in your
              inbox, not spam or junk.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={downloadVCard}
            >
              Download contact card
            </Button>
          </div>
          <div className="w-full rounded-lg border border-dashed px-4 py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              If your email app did not open, enter your email address and
              MediaPulse will send you a confirmation link instead.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={openEmailConfirmationFallback}
            >
              Send confirmation email
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={resetForm}>
            Subscribe to another ticker
          </Button>
        </div>

        <SendConfirmationEmailModal
          open={confirmEmailOpen}
          onOpenChange={setConfirmEmailOpen}
          email={modalConfirmationEmail}
          onEmailChange={setConfirmationEmail}
          onSendEmail={handleSendConfirmationEmail}
          sending={sendingEmail}
          tickerSymbol={selectedTicker?.KodeEmiten}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="size-5" />
          </div>
          <h1 className="text-xl font-bold">Subscribe to MediaPulse</h1>
          <p className="text-balance text-center text-sm text-muted-foreground">
            Enter your name and ticker, then choose how you want to subscribe.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">What should we call you?</Label>
            <Input
              id="name"
              placeholder="John Doe"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="language">Newsletter language</Label>
            <select
              id="language"
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as RegistrationLanguage)
              }
              className={cn(
                "border-input dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              )}
            >
              {REGISTRATION_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                      aria-selected={
                        selectedTicker?.KodeEmiten === t.KodeEmiten
                      }
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
            disabled={!selectedTicker || !name.trim()}
          >
            Subscribe
          </Button>
        </form>
        <p className="text-balance text-center text-xs text-muted-foreground">
          By subscribing, you agree to receive daily stock updates.
          <br />
          You can unsubscribe at any time.
        </p>
      </div>

      <SubscribeMailAppModal
        open={mailChoiceOpen}
        onOpenChange={setMailChoiceOpen}
        options={mailAppOptions}
        onSelectOutlook={handleSelectOutlook}
        onSelectNativeMail={handleSelectNativeMail}
        onSelectOther={handleSelectOther}
      />

      <SendConfirmationEmailModal
        open={confirmEmailOpen}
        onOpenChange={setConfirmEmailOpen}
        email={modalConfirmationEmail}
        onEmailChange={setConfirmationEmail}
        onSendEmail={handleSendConfirmationEmail}
        sending={sendingEmail}
        tickerSymbol={selectedTicker?.KodeEmiten}
      />
    </>
  );
};

export { RegistrationForm };
