import {
  resolvePath,
  type DetailBlock,
  type DetailBlockKeyValueRow,
} from "@hermes/domain-contract";

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

export const keyValueRowHasValue = (
  row: DetailBlockKeyValueRow,
  data: unknown,
): boolean => {
  if (row.format === "tokens") {
    return (
      row.tokenFields !== undefined &&
      !isEmptyValue(resolvePath(data, row.tokenFields.total))
    );
  }

  return !isEmptyValue(resolvePath(data, row.field));
};

export const detailBlockHasContent = (
  block: DetailBlock,
  data: unknown,
): boolean => {
  if (block.type === "keyValue") {
    return block.rows.some((row) => keyValueRowHasValue(row, data));
  }
  if (block.type === "markdown") {
    return !isEmptyValue(resolvePath(data, block.field));
  }
  if (block.type === "panel") {
    return block.blocks.some((child) => detailBlockHasContent(child, data));
  }

  return true;
};
