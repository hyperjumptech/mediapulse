import { useCallback, useMemo, useState } from "react";

import type { ScheduleExecutionInvocationRow } from "./use-schedule-execution-invocations-modal";

/** Which timestamp column is driving the current sort order. */
export type ScheduleExecutionInvocationSortField = "startedAt" | "completedAt";

export type ScheduleExecutionInvocationSortDir = "asc" | "desc";

/**
 * Compares two optional ISO date strings; missing values sort after present values.
 *
 * @param a - ISO string or null.
 * @param b - ISO string or null.
 * @param dir - Sort direction multiplier (asc = 1, desc = -1).
 */
export const compareOptionalIsoDates = (
  a: string | null,
  b: string | null,
  dir: 1 | -1,
): number => {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return (ta - tb) * dir;
};

/**
 * Client-side sort for invocation rows (started / completed columns).
 *
 * @param rows - Rows to sort (not mutated).
 * @param sortField - Active sort column.
 * @param sortDir - Ascending or descending.
 * @returns New array sorted by the chosen timestamp.
 */
export const sortScheduleExecutionInvocationRows = (
  rows: ScheduleExecutionInvocationRow[],
  sortField: ScheduleExecutionInvocationSortField,
  sortDir: ScheduleExecutionInvocationSortDir,
): ScheduleExecutionInvocationRow[] => {
  const dir: 1 | -1 = sortDir === "asc" ? 1 : -1;
  const pick =
    sortField === "startedAt"
      ? (r: ScheduleExecutionInvocationRow) => r.startedAtIso
      : (r: ScheduleExecutionInvocationRow) => r.completedAtIso;
  return [...rows].sort((a, b) =>
    compareOptionalIsoDates(pick(a), pick(b), dir),
  );
};

/**
 * Holds sort field/direction and derived sorted rows for the invocations table.
 *
 * @param rows - Invocation rows from the server (already masked).
 * @returns Current sort state, toggle handler, and rows sorted for display.
 */
export const useScheduleExecutionInvocationsSort = (
  rows: ScheduleExecutionInvocationRow[],
) => {
  const [sortField, setSortField] =
    useState<ScheduleExecutionInvocationSortField>("startedAt");
  const [sortDir, setSortDir] =
    useState<ScheduleExecutionInvocationSortDir>("asc");

  const sortedRows = useMemo(
    () => sortScheduleExecutionInvocationRows(rows, sortField, sortDir),
    [rows, sortField, sortDir],
  );

  const toggleSort = useCallback(
    (field: ScheduleExecutionInvocationSortField) => {
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  return {
    sortedRows,
    sortField,
    sortDir,
    toggleSort,
  };
};
