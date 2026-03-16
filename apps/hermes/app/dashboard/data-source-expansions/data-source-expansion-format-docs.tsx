"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import { Button } from "@workspace/ui/components/button";
import { ChevronRight } from "lucide-react";

/**
 * Format documentation and examples for data source expansion strings.
 * Shown on create and edit pages.
 */
export const DataSourceExpansionFormatDocs = () => {
  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-lg border border-border"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 [&[data-state=open]>svg.chevron]:rotate-90"
          aria-label="Toggle format documentation"
        >
          <span>Format and examples</span>
          <ChevronRight className="chevron size-4 shrink-0 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground space-y-3">
          <p>
            <strong className="text-foreground">Format:</strong>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              db:table:field?options
            </code>
          </p>
          <p>
            <strong className="text-foreground">Options</strong> (query string
            after <code className="rounded bg-muted px-1 font-mono">?</code>):
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>
              <code className="rounded bg-muted px-1 font-mono">
                where.&lt;key&gt;=&lt;value&gt;
              </code>{" "}
              — filter rows (e.g.{" "}
              <code className="rounded bg-muted px-1 font-mono">
                where.enabled=true
              </code>
              )
            </li>
            <li>
              <code className="rounded bg-muted px-1 font-mono">
                distinct=&lt;field&gt;
              </code>{" "}
              — distinct values
            </li>
            <li>
              <code className="rounded bg-muted px-1 font-mono">
                take=&lt;n&gt;
              </code>{" "}
              or{" "}
              <code className="rounded bg-muted px-1 font-mono">
                limit=&lt;n&gt;
              </code>{" "}
              — max rows (default 500, max 5000)
            </li>
            <li>
              <code className="rounded bg-muted px-1 font-mono">
                orderBy=&lt;field&gt;:asc|desc
              </code>{" "}
              — sort order
            </li>
          </ul>
          <p>
            <strong className="text-foreground">Examples:</strong>
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
            {`db:ticker:id
db:ticker:id?orderBy=id:asc
db:ticker:id?where.id=123
db:userTicker:tickerId?where.enabled=true&distinct=tickerId&take=500`}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
