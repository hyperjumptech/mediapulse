import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactElement, ReactNode } from "react";

/** Languages the shared email chrome (branding line) is translated into. */
export type EmailLanguage = "en" | "id";

/** Default Mediapulse marketing site link used for previews and when config omits the URL. */
export const DEFAULT_MEDIAPULSE_SITE_URL = "https://mediapulse.hyperjump.tech";

/** Default Hyperjump marketing site link used for previews and when config omits the URL. */
export const DEFAULT_HYPERJUMP_SITE_URL = "https://hyperjump.tech";

/** Brand link color, shared by the Tailwind palette and inline link styles. */
const BRAND_BLUE = "#2563eb";

/**
 * Tailwind theme shared by every email. Semantic color tokens keep text, rules,
 * and surfaces consistent; spacing and sizing use the default Tailwind scale
 * (4px base) applied via utility classes.
 */
export const emailTailwindConfig = {
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        body: "#374151",
        muted: "#6b7280",
        faint: "#9ca3af",
        brand: BRAND_BLUE,
        rule: "#e6ebf1",
        canvas: "#f6f9fc",
      },
    },
  },
};

/**
 * Inline link style for anchors rendered outside the Tailwind tree (inline
 * markdown links and template body links). Matches the `brand` palette token.
 */
export const emailLink: CSSProperties = {
  color: BRAND_BLUE,
  textDecoration: "underline",
};

/**
 * Layered box-shadow that makes the card read as a small stack of paper: two
 * sheets peek out below the card (a white one, then a fainter gray one), each
 * with a soft drop shadow. Degrades to a flat card in clients that ignore
 * box-shadow (e.g. Outlook).
 */
const cardStack: CSSProperties = {
  boxShadow: [
    "0 1px 3px rgba(16,24,40,0.08)",
    "0 10px 0 -5px #ffffff",
    "0 10px 5px -5px rgba(16,24,40,0.10)",
    "0 20px 0 -10px #f3f4f6",
    "0 20px 6px -10px rgba(16,24,40,0.08)",
  ].join(", "),
};

/** Branding line copy, split around the Mediapulse and Hyperjump links. */
const BRANDING_COPY: Record<
  EmailLanguage,
  { prefix: string; middle: string; suffix: string }
> = {
  en: { prefix: "Brought to you by ", middle: ", a product of ", suffix: "." },
  id: { prefix: "Dipersembahkan oleh ", middle: ", produk dari ", suffix: "." },
};

/** Shared heading style used for the title of every email. */
export const emailHeadingClassName =
  "m-0 mb-2 text-2xl font-semibold leading-tight text-ink";

/** Shared paragraph style used for body copy in every email. */
export const emailParagraphClassName =
  "m-0 whitespace-pre-wrap text-base leading-relaxed text-body";

/** Shared full-width divider style. */
export const emailDividerClassName = "my-6 border-0 border-t border-rule";

/** Shared link style used for anchors styled with a className. Blue in both schemes. */
export const emailLinkClassName = "text-brand underline";

/** Footer copy passed by a template; rendered in the shared centered footer. */
export interface EmailFooterContent {
  /** Optional feedback invitation line. */
  feedback?: string;
  /** Optional context/disclaimer line (e.g. the subscription note). */
  note?: ReactNode;
  /** Optional unsubscribe link. */
  unsubscribe?: { url: string; label: string };
}

export interface EmailShellProps {
  /** Inbox preview text. */
  preview: string;
  /** Card body content. */
  children: ReactNode;
  /** Branding line language. Defaults to "en". */
  language?: EmailLanguage;
  /** HTTPS URL for the Mediapulse footer link. */
  mediapulseSiteUrl?: string;
  /** HTTPS URL for the Hyperjump footer link. */
  hyperjumpSiteUrl?: string;
  /** Footer lines shown below the branding line. */
  footer?: EmailFooterContent;
}

/**
 * Shared layout for every Mediapulse email: a paper-stack white card holding the
 * `children`, with a centered footer rendered outside the card. The branding
 * line is localized; templates pass their own footer lines.
 *
 * @param props - See {@link EmailShellProps}.
 * @returns The email document tree.
 */
export const EmailShell = ({
  preview,
  children,
  language = "en",
  mediapulseSiteUrl = DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl = DEFAULT_HYPERJUMP_SITE_URL,
  footer,
}: EmailShellProps): ReactElement => {
  const branding = BRANDING_COPY[language];

  return (
    <Html>
      <Tailwind config={emailTailwindConfig}>
        <Head />
        <Preview>{preview}</Preview>
        <Body className="m-0 bg-canvas p-0 font-sans">
          <Container
            className="mx-auto my-8 max-w-[600px] bg-white px-6 py-8 max-sm:mt-0"
            style={cardStack}
          >
            {children}
          </Container>
          <Container className="mx-auto max-w-[650px] px-6 pb-8 text-center">
            <Text className="m-0 mb-2 text-center text-[13px] leading-normal text-body">
              {branding.prefix}
              <Link href={mediapulseSiteUrl} className={emailLinkClassName}>
                MediaPulse
              </Link>
              {branding.middle}
              <Link href={hyperjumpSiteUrl} className={emailLinkClassName}>
                Hyperjump
              </Link>
              {branding.suffix}
            </Text>
            {footer?.feedback !== undefined ? (
              <Text className="m-0 mb-2 text-center text-xs leading-normal text-muted">
                {footer.feedback}
              </Text>
            ) : null}
            {footer?.note !== undefined ? (
              <Text className="m-0 mb-2 text-center text-xs leading-normal text-muted">
                {footer.note}
              </Text>
            ) : null}
            {footer?.unsubscribe !== undefined ? (
              <Text className="m-0 text-center text-xs text-faint">
                <Link
                  href={footer.unsubscribe.url}
                  className={emailLinkClassName}
                >
                  {footer.unsubscribe.label}
                </Link>
              </Text>
            ) : null}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

/**
 * Title heading for an email body.
 *
 * @param props.children - Heading text.
 * @returns A styled `Heading`.
 */
export const EmailHeading = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <Heading className={emailHeadingClassName}>{children}</Heading>
);

/**
 * Body paragraph for an email.
 *
 * @param props.children - Paragraph content.
 * @returns A styled `Text`.
 */
export const EmailParagraph = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => <Text className={emailParagraphClassName}>{children}</Text>;

/**
 * Full-width divider between an email's heading and body.
 *
 * @returns A styled `Hr`.
 */
export const EmailDivider = (): ReactElement => (
  <Hr className={emailDividerClassName} />
);

/**
 * Highlighted info callout for an actionable tip. Rendered as a tinted box with
 * a brand accent so it stands out from the surrounding body copy.
 *
 * @param props.title - Optional bold lead line.
 * @param props.children - Callout body content.
 * @returns A styled `Section`.
 */
export const EmailCallout = ({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}): ReactElement => (
  <Section className="my-4 rounded-lg border border-l-4 border-rule border-l-brand bg-canvas px-4 py-3">
    {title !== undefined ? (
      <Text className="m-0 mb-1 text-sm font-semibold text-ink">{title}</Text>
    ) : null}
    <Text className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-body">
      {children}
    </Text>
  </Section>
);
