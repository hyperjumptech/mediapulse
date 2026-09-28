"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

export const DetailBlockCopyButton = ({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) => {
  const { copied, copy } = useCopyToClipboard();
  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => {
        void copy(value);
      }}
      aria-label={copied ? "Copied" : label}
      title={label}
      className={cn("size-7 shrink-0 text-muted-foreground", className)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </Button>
  );
};
