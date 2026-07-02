"use client";

import { MailX, CheckCircle2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  getUnsubscribeCopy,
  type UnsubscribeLanguage,
} from "@/lib/unsubscribe-copy";
import { useUnsubscribeConfirm } from "@/hooks/use-unsubscribe-confirm";

type Props = {
  token: string;
  tickerSymbol: string;
  language: UnsubscribeLanguage;
};

/**
 * Confirmation control for the unsubscribe page.
 *
 * Renders a Confirm button that performs the unsubscribe only when pressed, then shows the
 * outcome in place. Nothing is changed until the user confirms.
 *
 * @param props - The component props.
 * @param props.token - Signed unsubscribe token to submit.
 * @param props.tickerSymbol - Ticker symbol shown in the prompt.
 * @param props.language - Language for the copy.
 * @returns The unsubscribe confirmation component.
 */
const UnsubscribeConfirm = ({ token, tickerSymbol, language }: Props) => {
  const copy = getUnsubscribeCopy(language);
  const { pending, result, confirm } = useUnsubscribeConfirm(token);

  if (result) {
    const isSuccess =
      result.status === "unsubscribed" ||
      result.status === "already_unsubscribed";

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
          {copy.outcome(result.status, result.displaySymbol ?? tickerSymbol)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailX className="size-8" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.prompt(tickerSymbol)}
        </p>
      </div>
      <Button className="w-full" onClick={confirm} disabled={pending}>
        {pending ? copy.confirming : copy.confirmButton}
      </Button>
    </div>
  );
};

export { UnsubscribeConfirm };
