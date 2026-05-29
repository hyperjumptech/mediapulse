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
