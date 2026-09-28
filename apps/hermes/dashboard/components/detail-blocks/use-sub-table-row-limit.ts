"use client";

import { useState } from "react";

export const ALL_ROWS_VALUE = "all";

export const useSubTableRowLimit = <Row>({
  rows,
  options,
  defaultAll,
}: {
  rows: readonly Row[];
  options: readonly number[];
  defaultAll?: boolean;
}) => {
  const [value, setValue] = useState<string>(
    defaultAll ? ALL_ROWS_VALUE : String(options[0]),
  );
  const limit = value === ALL_ROWS_VALUE ? rows.length : Number(value);

  return { value, setValue, visibleRows: rows.slice(0, limit) };
};
