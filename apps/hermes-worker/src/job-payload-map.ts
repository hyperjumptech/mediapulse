/**
 * DataQueue job payload map for Hermes. Keys are job types; values are payload shapes.
 * The scheduler uses a single job type that polls the Schedule table for due runs.
 */
export type JobPayloadMap = {
  check_schedules: {
    timestamp?: string;
  };
};
