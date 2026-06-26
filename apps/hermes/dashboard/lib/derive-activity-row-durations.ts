/** One agent activity row returned by the data-api for a Hermes job. */
export type ActivityRow = {
  id: string;
  title: string;
  description: string | null;
  status: "processing" | "completed";
  createdAt: string;
  durationMs?: number | null;
};

type ActivityRowFromServer = Omit<ActivityRow, "durationMs">;

/**
 * Whether the row should show an in-progress spinner in the activity dialog.
 *
 * New checkpoints complete prior `processing` rows on the server; older runs may
 * still have stale status until the UI infers completion from row order. A
 * terminal job (cancelled, failed, or completed) never spins, even when its last
 * row is stuck on `processing` because the agent could not post a final step.
 *
 * @param row - Activity row from the server.
 * @param index - Zero-based index in the ordered list.
 * @param rowCount - Total rows for the job.
 * @param jobIsActive - Whether the owning job is still running (not terminal).
 * @returns True only for the last row while the run is still open.
 */
export const isActivityRowInProgress = (
  row: Pick<ActivityRow, "status">,
  index: number,
  rowCount: number,
  jobIsActive: boolean,
): boolean =>
  jobIsActive && index === rowCount - 1 && row.status === "processing";

/**
 * Derives per-step durations from consecutive `createdAt` timestamps.
 *
 * @param rows - Activity rows ordered oldest first from the data-api.
 * @returns Rows with `durationMs` filled for display.
 */
export const attachActivityRowDurations = (
  rows: ActivityRowFromServer[],
): ActivityRow[] => {
  if (rows.length === 0) {
    return [];
  }

  const firstCreatedAt = Date.parse(rows[0]!.createdAt);
  const lastCreatedAt = Date.parse(rows[rows.length - 1]!.createdAt);
  const totalFallbackMs = lastCreatedAt - firstCreatedAt;

  return rows.map((row, index) => {
    if (index < rows.length - 1) {
      return {
        ...row,
        durationMs:
          Date.parse(rows[index + 1]!.createdAt) - Date.parse(row.createdAt),
      };
    }

    if (row.status === "processing") {
      return { ...row, durationMs: null };
    }

    return { ...row, durationMs: totalFallbackMs };
  });
};
