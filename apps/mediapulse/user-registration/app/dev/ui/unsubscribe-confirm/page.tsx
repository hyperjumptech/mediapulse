import { notFound } from "next/navigation";
import { MailX, CheckCircle2 } from "lucide-react";

import { env } from "@mediapulse/env/app-user-registration";

import { HyperjumpProductAttribution } from "@/components/hyperjump-product-attribution";
import { UnsubscribeConfirm } from "@/components/unsubscribe-confirm";
import { getUnsubscribeCopy } from "@/lib/unsubscribe-copy";
import type { UnsubscribeStatus } from "@/lib/unsubscribe-api";

const PREVIEW_SYMBOL = "BBCA";

/**
 * Static preview of a token-invalid state (expired / invalid) without a real token.
 */
const MessageState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <MailX className="size-8" aria-hidden />
    </div>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

/**
 * Static preview of a post-confirm outcome without calling agent-data-api.
 */
const OutcomeState = ({ status }: { status: UnsubscribeStatus }) => {
  const copy = getUnsubscribeCopy("en");
  const isSuccess =
    status === "unsubscribed" || status === "already_unsubscribed";

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {isSuccess ? (
          <CheckCircle2 className="size-8" aria-hidden />
        ) : (
          <MailX className="size-8" aria-hidden />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {copy.outcome(status, PREVIEW_SYMBOL)}
      </p>
    </div>
  );
};

const PreviewCell = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border p-6">
    <span className="text-xs font-mono text-muted-foreground">{label}</span>
    {children}
  </div>
);

/**
 * Development-only preview of every unsubscribe confirmation state. Renders the interactive
 * confirm prompt (English and Indonesian), the token-invalid messages, and each post-confirm
 * outcome using static fixtures. Returns 404 outside `development`.
 *
 * @returns The unsubscribe preview grid.
 */
const DevUnsubscribeConfirmPage = () => {
  if (env.NODE_ENV !== "development") {
    notFound();
  }

  const en = getUnsubscribeCopy("en");
  const outcomes: UnsubscribeStatus[] = [
    "unsubscribed",
    "already_unsubscribed",
    "not_found",
    "invalid",
  ];

  return (
    <div className="flex min-h-svh flex-col items-center gap-6 bg-background p-6 md:p-10">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        <PreviewCell label="valid · en">
          <UnsubscribeConfirm
            token="preview-token"
            tickerSymbol={PREVIEW_SYMBOL}
            language="en"
          />
        </PreviewCell>
        <PreviewCell label="valid · id">
          <UnsubscribeConfirm
            token="preview-token"
            tickerSymbol={PREVIEW_SYMBOL}
            language="id"
          />
        </PreviewCell>
        <PreviewCell label="expired">
          <MessageState message={en.expired} />
        </PreviewCell>
        <PreviewCell label="invalid">
          <MessageState message={en.invalid} />
        </PreviewCell>
        {outcomes.map((status) => (
          <PreviewCell key={status} label={`outcome · ${status}`}>
            <OutcomeState status={status} />
          </PreviewCell>
        ))}
      </div>
      <HyperjumpProductAttribution />
    </div>
  );
};

export default DevUnsubscribeConfirmPage;
