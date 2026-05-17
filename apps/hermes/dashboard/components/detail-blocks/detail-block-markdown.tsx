"use client";

import {
  clampMarkdownBody,
  resolvePath,
  type DetailBlockMarkdown,
} from "@hermes/domain-contract";

import { Button } from "@workspace/ui/components/button";

import { DetailBlockCopyButton } from "./detail-block-copy-button";
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { parseMarkdownBody, renderInlineNodes } from "./markdown-renderer";
import { useMarkdownClamp } from "./use-markdown-clamp";

/**
 * Renders a `markdown` detail block. Handles the clamp/expand affordance,
 * the optional copy button, and the section-header rule.
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockMarkdownView = ({
  block,
  data,
}: {
  block: DetailBlockMarkdown;
  data: unknown;
}) => {
  const raw = resolvePath(data, block.field);
  const body = typeof raw === "string" ? raw : "";
  const clampOptions = block.clampChars
    ? {
        clampChars: block.clampChars,
        clampThreshold: block.clampThreshold,
      }
    : undefined;
  const clampedState = clampOptions
    ? clampMarkdownBody(body, clampOptions)
    : { visible: body, clamped: false, originalLength: body.length };
  const { text, showExpander, expanded, toggle } = useMarkdownClamp(
    body,
    clampedState,
  );
  const blocks = parseMarkdownBody(text);
  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <div className="prose-sm max-w-3xl space-y-3 text-sm">
        {blocks.map((parsed, index) => {
          if (parsed.kind === "heading") {
            const Tag = `h${parsed.level + 2}` as "h3" | "h4" | "h5";
            return (
              <Tag key={`h-${index}`} className="font-semibold">
                {renderInlineNodes(parsed.children, `h-${index}`)}
              </Tag>
            );
          }
          if (parsed.kind === "paragraph") {
            return (
              <p key={`p-${index}`}>
                {renderInlineNodes(parsed.children, `p-${index}`)}
              </p>
            );
          }
          const ListTag = parsed.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`l-${index}`}
              className={
                parsed.ordered ? "list-decimal pl-6" : "list-disc pl-6"
              }
            >
              {parsed.items.map((item, itemIndex) => (
                <li key={`l-${index}-${itemIndex}`}>
                  {renderInlineNodes(item.children, `l-${index}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        {showExpander ? (
          <Button type="button" variant="outline" size="sm" onClick={toggle}>
            {expanded ? "Show less" : "Show full"}
          </Button>
        ) : null}
        {block.copyAction === true && body.length > 0 ? (
          <DetailBlockCopyButton
            value={body}
            label={`Copy ${block.label ?? "markdown"} body`}
          />
        ) : null}
      </div>
    </section>
  );
};
