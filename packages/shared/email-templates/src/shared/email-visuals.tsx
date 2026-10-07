import { Column, Row, Section, Text } from "@react-email/components";
import {
  Fragment,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

const BAR_HEIGHT: CSSProperties = {
  height: "8px",
  lineHeight: "8px",
  fontSize: "0",
};

const MIN_BAR_PERCENT = 4;

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
    className="e-inverse m-0 rounded-lg bg-ink text-center text-[13px] font-bold tracking-[0.04em] text-white"
    style={{ width: "64px", height: "44px", lineHeight: "44px" }}
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

export interface EmailStat {
  value: string;
  label: string;
}

const STAT_GUTTER_PERCENT = 2;

export const EmailStatStrip = ({
  stats,
}: {
  stats: EmailStat[];
}): ReactElement => {
  const gutterTotalPercent = STAT_GUTTER_PERCENT * (stats.length - 1);
  const tilePercent = Math.floor((100 - gutterTotalPercent) / stats.length);
  const tileWidth = `${String(tilePercent)}%`;
  const gutterWidth = `${String(STAT_GUTTER_PERCENT)}%`;

  return (
    <Row>
      {stats.map((stat, statIndex) => (
        <Fragment key={stat.label}>
          {statIndex > 0 ? <Column style={{ width: gutterWidth }} /> : null}
          <Column
            className="e-tile rounded-lg border border-solid border-rule bg-canvas px-3 py-3"
            style={{ width: tileWidth, verticalAlign: "top" }}
          >
            <Text className="e-ink m-0 text-[26px] font-bold leading-none text-ink">
              {stat.value}
            </Text>
            <Text className="e-muted m-0 mt-1.5 text-xs leading-snug text-muted">
              {stat.label}
            </Text>
          </Column>
        </Fragment>
      ))}
    </Row>
  );
};

export const EmailBarRow = ({
  label,
  valueLabel,
  ratio,
}: {
  label: string;
  valueLabel: string;
  ratio: number;
}): ReactElement => {
  const boundedPercent = Math.min(100, Math.round(ratio * 100));
  const filledPercent = Math.max(MIN_BAR_PERCENT, boundedPercent);

  return (
    <Section className="mb-4">
      <Row>
        <Column style={{ verticalAlign: "bottom" }}>
          <Text className="e-ink m-0 text-sm font-semibold leading-snug text-ink">
            {label}
          </Text>
        </Column>
        <Column style={{ width: "96px", verticalAlign: "bottom" }}>
          <Text className="e-muted m-0 text-right text-xs leading-snug text-muted">
            {valueLabel}
          </Text>
        </Column>
      </Row>
      <Row
        className="e-bar-track mt-1.5 rounded-full bg-rule"
        style={BAR_HEIGHT}
      >
        <Column style={BAR_HEIGHT}>
          <div
            className="e-bar rounded-full bg-brand"
            style={{ ...BAR_HEIGHT, width: `${String(filledPercent)}%` }}
          >
            &nbsp;
          </div>
        </Column>
      </Row>
    </Section>
  );
};

export const EmailTimelineStep = ({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}): ReactElement => (
  <Row className="mb-4">
    <Column style={{ width: "44px", verticalAlign: "top" }}>
      <Text
        className="e-badge m-0 rounded-full bg-brand text-center text-[13px] font-bold text-white"
        style={{ width: "28px", height: "28px", lineHeight: "28px" }}
      >
        {String(step)}
      </Text>
    </Column>
    <Column style={{ verticalAlign: "top" }}>
      <Text className="e-ink m-0 text-[15px] font-semibold leading-snug text-ink">
        {title}
      </Text>
      <Text className="e-body m-0 mt-0.5 text-sm leading-relaxed text-body">
        {children}
      </Text>
    </Column>
  </Row>
);
