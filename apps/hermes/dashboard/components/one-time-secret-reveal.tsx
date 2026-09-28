"use client";

import type { ReactNode } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type OneTimeSecretRevealProps = {
  secret: string;
  secretLabel: string;
  children?: ReactNode;
};

export const OneTimeSecretReveal = ({
  secret,
  secretLabel,
  children,
}: OneTimeSecretRevealProps) => {
  const { copied, copy } = useCopyToClipboard();
  const CopyIcon = copied ? Check : Copy;
  const copyButtonLabel = copied ? "Copied" : "Copy to clipboard";

  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-warning/40 bg-warning/10 [&>svg]:text-warning">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle className="line-clamp-none">
          Copy this key now. It won&apos;t be shown again.
        </AlertTitle>
        {children ? (
          <AlertDescription className="text-foreground/80">
            {children}
          </AlertDescription>
        ) : null}
      </Alert>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{secretLabel}</p>
        <div className="relative rounded-md border bg-muted/50">
          <pre className="p-3 pr-12 font-mono text-sm break-all whitespace-pre-wrap">
            {secret}
          </pre>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1.5 right-1.5"
            aria-label={copyButtonLabel}
            onClick={() => copy(secret)}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
