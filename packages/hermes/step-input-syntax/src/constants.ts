/** Default max rows when take/limit omitted in a `db:` expansion string. */
export const DEFAULT_TAKE = 500;

/**
 * Default hard cap on rows returned per expansion. Override at runtime via
 * Hermes / worker env (e.g. `HERMES_DATA_SOURCE_MAX_TAKE`) where wired.
 */
export const MAX_TAKE = 5000;
