"use client";

import { Check, ChevronDown, ChevronUp, Copy, WrapText } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Toggle } from "@workspace/ui/components/toggle";
import { cn } from "@workspace/ui/lib/utils";

import { useJsonBlock } from "@/hooks/use-json-block";

export type JsonBlockProps = {
  value: unknown;
  title?: string;
  maxHeight?: string;
};

const JsonBlockTitle = ({ title }: { title?: string }) => {
  if (!title) {
    return null;
  }

  return (
    <h3 className="min-w-0 text-sm font-medium break-words text-foreground">
      {title}
    </h3>
  );
};

export const JsonBlock = ({
  value,
  title,
  maxHeight = "max-h-96",
}: JsonBlockProps) => {
  const {
    formatted,
    bodyId,
    bodyRef,
    copied,
    copyFormatted,
    isWrapped,
    setWrapped,
    isExpanded,
    canExpand,
    toggleExpanded,
  } = useJsonBlock(value);

  if (formatted === null) {
    return (
      <div
        data-slot="json-block"
        data-empty="true"
        className="flex min-w-0 flex-col gap-2"
      >
        <JsonBlockTitle title={title} />
        <p className="text-sm text-muted-foreground">—</p>
      </div>
    );
  }

  const copyTarget = title ? title.toLowerCase() : "JSON";
  const copyLabel = copied ? "Copied" : `Copy ${copyTarget}`;
  const CopyIcon = copied ? Check : Copy;
  const ExpandIcon = isExpanded ? ChevronUp : ChevronDown;
  const expandLabel = isExpanded ? "Show less" : "Show all";

  return (
    <div data-slot="json-block" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <JsonBlockTitle title={title} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Toggle
            size="sm"
            pressed={isWrapped}
            onPressedChange={setWrapped}
            aria-label="Wrap lines"
            className="px-2.5 text-muted-foreground"
          >
            <WrapText aria-hidden />
            Wrap
          </Toggle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={copyLabel}
            onClick={() => void copyFormatted()}
          >
            <CopyIcon aria-hidden />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/40">
        <div
          ref={bodyRef}
          id={bodyId}
          role="region"
          aria-label={title ?? "JSON"}
          tabIndex={0}
          className={cn(
            "overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
            !isExpanded && maxHeight,
          )}
        >
          <pre
            className={cn(
              "p-3 font-mono text-xs leading-relaxed text-foreground",
              isWrapped
                ? "whitespace-pre-wrap break-words"
                : "w-max min-w-full whitespace-pre",
            )}
          >
            <code>{formatted}</code>
          </pre>
        </div>
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full rounded-none border-t text-muted-foreground hover:text-foreground focus-visible:ring-inset"
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            onClick={toggleExpanded}
          >
            <ExpandIcon aria-hidden />
            {expandLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
