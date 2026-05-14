"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@workspace/ui/components/button";

/**
 * Small copy-to-clipboard button. Writes the provided text and briefly shows a
 * checkmark to confirm success. Uses `navigator.clipboard` when available,
 * with a textarea fallback for older browsers.
 *
 * @param props.value - Text written to clipboard on click.
 * @param props.label - Accessible button label, e.g. "Copy newsletter id".
 */
export const DetailBlockCopyButton = ({
  value,
  label,
}: {
  value: string;
  label: string;
}) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleClick = async () => {
    const success = await writeToClipboard(value);
    if (success) setCopied(true);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={label}
      className="h-7 px-2"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="ml-1 text-xs">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="ml-1 text-xs">Copy</span>
        </>
      )}
    </Button>
  );
};

const writeToClipboard = async (value: string): Promise<boolean> => {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through to textarea */
    }
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
};
