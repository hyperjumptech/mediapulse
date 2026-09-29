import {
  renderUrlTemplate,
  resolvePath,
  type DetailBlockKeyValue,
  type DetailBlockKeyValueRow,
} from "@hermes/domain-contract";

import { DateTime } from "@/components/date-time/date-time";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import { toValidDate } from "@/lib/date-time/format-date-time";
import { isUnbrokenText } from "@/lib/unbroken-text";

import { keyValueRowHasValue } from "./detail-block-content";
import { DetailBlockCopyButton } from "./detail-block-copy-button";
import { DetailBlockSectionHeader } from "./detail-block-section-header";

const formatNumber = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toLocaleString();
  }
  return "—";
};

const formatPlain = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const formatTokens = (row: DetailBlockKeyValueRow, data: unknown): string => {
  const fields = row.tokenFields;
  if (!fields) return "—";
  const prompt = resolvePath(data, fields.prompt);
  const completion = resolvePath(data, fields.completion);
  const total = resolvePath(data, fields.total);
  const fmt = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString()
      : "—";
  return `${fmt(prompt)} + ${fmt(completion)} = ${fmt(total)}`;
};

const copyValueFor = (raw: unknown): string => {
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";

  return String(raw);
};

const DetailBlockKeyValueRowView = ({
  row,
  data,
}: {
  row: DetailBlockKeyValueRow;
  data: unknown;
}) => {
  const raw = resolvePath(data, row.field);
  const url = row.linkTemplate
    ? renderUrlTemplate(row.linkTemplate, data)
    : undefined;
  const date = row.format === "date-time" ? toValidDate(raw) : null;
  const text = (() => {
    if (row.format === "tokens") return formatTokens(row, data);
    if (row.format === "number") return formatNumber(raw);
    return formatPlain(raw);
  })();
  const content = date ? <DateTime value={date} style="datetime" /> : text;
  const copyValue = copyValueFor(raw);
  const showCopy = row.copyAction === true && copyValue.length > 0;
  const breakAll = date === null && isUnbrokenText(text);

  return (
    <SummaryItem label={row.label} breakAll={breakAll}>
      <div className="flex min-w-0 items-start gap-1">
        {url && text !== "—" ? (
          <a
            href={url}
            className="min-w-0 text-primary underline underline-offset-4"
          >
            {content}
          </a>
        ) : (
          <span className="min-w-0">{content}</span>
        )}
        {showCopy ? (
          <DetailBlockCopyButton
            value={copyValue}
            label={`Copy ${row.label}`}
            className="-my-1"
          />
        ) : null}
      </div>
    </SummaryItem>
  );
};

export const DetailBlockKeyValueView = ({
  block,
  data,
}: {
  block: DetailBlockKeyValue;
  data: unknown;
}) => {
  const rowsWithValues = block.rows.filter((row) =>
    keyValueRowHasValue(row, data),
  );
  if (rowsWithValues.length === 0) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <SummaryGrid variant="plain" className="max-w-3xl">
        {rowsWithValues.map((row) => (
          <DetailBlockKeyValueRowView
            key={`${row.field}:${row.label}`}
            row={row}
            data={data}
          />
        ))}
      </SummaryGrid>
    </section>
  );
};
