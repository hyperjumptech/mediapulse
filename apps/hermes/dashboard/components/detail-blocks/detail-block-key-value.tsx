import {
  renderUrlTemplate,
  resolvePath,
  type DetailBlockKeyValue,
  type DetailBlockKeyValueRow,
} from "@hermes/domain-contract";

import { DetailBlockCopyButton } from "./detail-block-copy-button";
import { DetailBlockSectionHeader } from "./detail-block-section-header";

const formatDateTime = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "string" && !(value instanceof Date)) {
    return String(value);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
};

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

/**
 * Renders one label/value row of a `keyValue` block. Honors `linkTemplate`,
 * `copyAction`, and `format` options on the row.
 */
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
  const text = (() => {
    if (row.format === "tokens") return formatTokens(row, data);
    if (row.format === "date-time") return formatDateTime(raw);
    if (row.format === "number") return formatNumber(raw);
    return formatPlain(raw);
  })();
  const copyValue =
    typeof raw === "string"
      ? raw
      : raw === null || raw === undefined
        ? ""
        : String(raw);
  return (
    <div className="grid gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {row.label}
      </dt>
      <dd className="flex items-center gap-2 break-words text-sm">
        {url && text !== "—" ? (
          <a href={url} className="text-primary underline underline-offset-4">
            {text}
          </a>
        ) : (
          <span>{text}</span>
        )}
        {row.copyAction === true && copyValue.length > 0 ? (
          <DetailBlockCopyButton
            value={copyValue}
            label={`Copy ${row.label}`}
          />
        ) : null}
      </dd>
    </div>
  );
};

/**
 * Renders a `keyValue` detail block — a grid of label/value rows pulled from
 * the detail response.
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockKeyValueView = ({
  block,
  data,
}: {
  block: DetailBlockKeyValue;
  data: unknown;
}) => {
  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <dl className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {block.rows.map((row) => (
          <DetailBlockKeyValueRowView
            key={`${row.field}:${row.label}`}
            row={row}
            data={data}
          />
        ))}
      </dl>
    </section>
  );
};
