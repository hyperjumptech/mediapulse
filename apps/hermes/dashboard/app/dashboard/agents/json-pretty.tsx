"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type JsonPrettyProps = {
  value: unknown;
  title?: string;
};

const JsonPrettyTitle = ({ title }: { title?: string }) => {
  if (!title) {
    return <span />;
  }

  return <h3 className="text-sm font-medium text-foreground">{title}</h3>;
};

export const JsonPretty = ({ value, title }: JsonPrettyProps) => {
  const { copied, copy } = useCopyToClipboard();

  if (value === null || value === undefined) {
    return (
      <div data-testid="json-pretty-empty" className="flex flex-col gap-2">
        <JsonPrettyTitle title={title} />
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No schema
        </p>
      </div>
    );
  }

  const jsonString = JSON.stringify(value, null, 2);
  const copyTarget = title?.toLowerCase() ?? "JSON";
  const copyLabel = copied ? "Copied" : `Copy ${copyTarget}`;
  const CopyIcon = copied ? Check : Copy;

  return (
    <div data-testid="json-pretty" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <JsonPrettyTitle title={title} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={copyLabel}
          onClick={() => void copy(jsonString)}
        >
          <CopyIcon aria-hidden />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40">
        <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre text-foreground">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};
