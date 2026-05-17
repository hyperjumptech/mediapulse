"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

/**
 * Small copy-to-clipboard button. Writes the provided text and briefly shows a
 * checkmark to confirm success. State and effects live in the shared
 * `useCopyToClipboard` hook so the component stays declarative.
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
  const { copied, copy } = useCopyToClipboard();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void copy(value);
      }}
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
