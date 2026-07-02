import { useState } from "react";
import type { UnsubscribeStatus } from "@/lib/unsubscribe-api";

export type UnsubscribeResult = {
  status: UnsubscribeStatus;
  displaySymbol?: string;
};

/**
 * Manages the unsubscribe confirmation control: submits the token on confirm and
 * exposes the pending state and outcome.
 *
 * @param token - Signed unsubscribe token to submit.
 * @returns The pending flag, the outcome (or `null` before confirming), and the confirm handler.
 */
export const useUnsubscribeConfirm = (token: string) => {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UnsubscribeResult | null>(null);

  const confirm = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/unsubscribe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as UnsubscribeResult;
      setResult(data);
    } catch {
      setResult({ status: "invalid" });
    } finally {
      setPending(false);
    }
  };

  return { pending, result, confirm };
};
