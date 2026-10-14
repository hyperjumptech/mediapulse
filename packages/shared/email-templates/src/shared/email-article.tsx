import { Hr, Link, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";

import { renderInlineMarkdownLinks } from "../newsletter/render-inline-markdown-links.js";
import { emailLink, emailLinkClassName } from "./email-shell.js";

const ARTICLE_SOURCE_LINK_CLASS_NAME =
  "e-faint text-faint underline decoration-dotted decoration-[0.5px] underline-offset-2";

export interface EmailArticleProps {
  title: string;
  url: string;
  source?: string;
  detail?: string;
  linkLabel: string;
  points: string[];
  isLast: boolean;
}

export const EmailArticle = ({
  title,
  url,
  source,
  detail,
  linkLabel,
  points,
  isLast,
}: EmailArticleProps): ReactElement => {
  const trimmedSource = source?.trim() ?? "";
  const linkText = trimmedSource.length > 0 ? trimmedSource : linkLabel;

  return (
    <Section>
      <Text className="e-ink m-0 mb-1 text-[17px] font-semibold leading-snug text-ink">
        {title}
      </Text>
      <Text className="e-faint m-0 mb-3 text-xs font-normal leading-normal tracking-[0.01em] text-faint">
        <Link
          href={url}
          className={ARTICLE_SOURCE_LINK_CLASS_NAME}
          title={linkLabel}
          aria-label={linkLabel}
        >
          {linkText}
        </Link>
        {detail !== undefined ? ` · ${detail}` : null}
      </Text>
      {points.length > 0 ? (
        <ul className="e-body m-0 mb-0 list-disc pl-5 text-[15px] leading-[1.65] text-body">
          {points.map((point, pointIndex) => (
            <li key={`p-${String(pointIndex)}`} className="mb-2 pl-1">
              {renderInlineMarkdownLinks(point, emailLink, {
                linkClassName: emailLinkClassName,
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {isLast ? null : (
        <Hr className="e-rule my-6 border-0 border-t border-rule" />
      )}
    </Section>
  );
};
