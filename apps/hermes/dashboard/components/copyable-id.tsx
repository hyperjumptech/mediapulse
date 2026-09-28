"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

export const CopyableId = ({
  value,
  label = "Copy ID",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) => {
  const { copied, copy } = useCopyToClipboard();
  const Icon = copied ? Check : Copy;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        aria-label={copied ? "Copied" : label}
        onClick={() => copy(value)}
      >
        <Icon className="size-3.5" />
      </Button>
    </span>
  );
};
