import { Section, Text } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";

export const EmailHeaderPanel = ({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}): ReactElement => {
  const paddingClassName = compact ? "px-5 py-4" : "px-5 py-5";

  return (
    <Section
      className={`e-tile mb-6 rounded-xl border border-solid border-rule bg-canvas ${paddingClassName}`}
    >
      {children}
    </Section>
  );
};

export const EmailInverseTag = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <span className="e-inverse inline-block rounded bg-ink px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-white">
    {children}
  </span>
);

export const EmailTickerBadge = ({
  tickerSymbol,
}: {
  tickerSymbol: string;
}): ReactElement => (
  <Text
    className="e-inverse m-0 rounded-md bg-ink text-center text-[11px] font-bold tracking-[0.06em] text-white"
    style={{ width: "48px", height: "24px", lineHeight: "24px" }}
  >
    {tickerSymbol}
  </Text>
);

export const EmailPill = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <span className="e-pill mb-2 mr-2 inline-block rounded-full border border-solid border-rule bg-white px-3 py-1 text-[13px] leading-snug text-body">
    {children}
  </span>
);

export const EmailTimelineStep = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement => (
  <Section className="mb-4">
    <Text className="e-ink m-0 text-[15px] font-semibold leading-snug text-ink">
      {title}
    </Text>
    <Text className="e-body m-0 mt-0.5 text-sm leading-relaxed text-body">
      {children}
    </Text>
  </Section>
);
