"use client";

import type { DashboardViewKind } from "@hermes/domain-contract";

import {
  parseMarkdownBody,
  renderInlineNodes,
} from "@/components/detail-blocks/markdown-renderer";

type DomainContentViewProps = {
  kind: Extract<DashboardViewKind, "markdown" | "html" | "text">;
  body: string;
  title?: string;
};

const renderHeading = (
  level: 1 | 2 | 3,
  children: ReturnType<typeof renderInlineNodes>,
) => {
  if (level === 1) {
    return (
      <h1 className="text-xl font-semibold text-foreground">{children}</h1>
    );
  }
  if (level === 2) {
    return (
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
    );
  }
  return (
    <h3 className="text-base font-semibold text-foreground">{children}</h3>
  );
};

/**
 * Renders domain-provided markdown, html, or plain text content.
 *
 * @param props - View kind and body from the domain content API.
 */
export const DomainContentView = ({
  kind,
  body,
  title,
}: DomainContentViewProps) => {
  if (kind === "text") {
    return (
      <div className="flex flex-col gap-4">
        {title ? (
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        ) : null}
        <pre className="whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/25 p-6 text-sm text-foreground">
          {body}
        </pre>
      </div>
    );
  }

  if (kind === "html") {
    return (
      <div className="flex flex-col gap-4">
        {title ? (
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        ) : null}
        <iframe
          srcDoc={body}
          sandbox="allow-popups"
          title={title ?? "Domain content"}
          className="min-h-[480px] w-full rounded-lg border border-border/50 bg-background"
        />
      </div>
    );
  }

  const blocks = parseMarkdownBody(body);
  return (
    <div className="flex flex-col gap-4">
      {title ? (
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      ) : null}
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
        {blocks.map((block, index) => {
          if (block.kind === "heading") {
            return (
              <div key={index}>
                {renderHeading(
                  block.level,
                  renderInlineNodes(block.children, `heading-${index}`),
                )}
              </div>
            );
          }
          if (block.kind === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={index}
                className={
                  block.ordered ? "list-decimal pl-6" : "list-disc pl-6"
                }
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    {renderInlineNodes(
                      item.children,
                      `list-${index}-${itemIndex}`,
                    )}
                  </li>
                ))}
              </ListTag>
            );
          }
          return (
            <p key={index} className="text-sm text-foreground">
              {renderInlineNodes(block.children, `paragraph-${index}`)}
            </p>
          );
        })}
      </div>
    </div>
  );
};
