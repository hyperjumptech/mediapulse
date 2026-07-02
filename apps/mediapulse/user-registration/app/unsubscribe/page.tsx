import { MailX } from "lucide-react";

import { HyperjumpProductAttribution } from "@/components/hyperjump-product-attribution";
import { UnsubscribeConfirm } from "@/components/unsubscribe-confirm";
import { readUnsubscribeToken } from "@/lib/read-unsubscribe-token";
import {
  getUnsubscribeCopy,
  toUnsubscribeLanguage,
} from "@/lib/unsubscribe-copy";

type SearchParams = Promise<{ token?: string; lang?: string }>;

/**
 * Unsubscribe confirmation page.
 *
 * Verifies the token locally (no database write) and, when valid, shows a Confirm button.
 * The subscription is only disabled after the user confirms. Invalid or expired links show
 * an explanatory message with no action.
 *
 * @param props - The page props.
 * @param props.searchParams - The `token` and optional `lang` query parameters.
 * @returns The rendered confirmation page.
 */
const UnsubscribePage = async ({
  searchParams,
}: {
  searchParams: SearchParams;
}) => {
  const { token = "", lang } = await searchParams;
  const language = toUnsubscribeLanguage(lang);
  const copy = getUnsubscribeCopy(language);
  const view = readUnsubscribeToken(token);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        {view.valid ? (
          <UnsubscribeConfirm
            token={token}
            tickerSymbol={view.tickerSymbol}
            language={language}
          />
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MailX className="size-8" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">
              {view.reason === "expired" ? copy.expired : copy.invalid}
            </p>
          </div>
        )}
        <HyperjumpProductAttribution />
      </div>
    </div>
  );
};

export default UnsubscribePage;
