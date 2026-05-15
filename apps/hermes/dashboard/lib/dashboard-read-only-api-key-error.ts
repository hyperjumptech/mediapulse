/**
 * Thrown when a read-only MCP API key calls a dashboard mutation route.
 */
export class DashboardReadOnlyApiKeyError extends Error {
  readonly code = "read_only_key" as const;

  /**
   * @param message - Human-readable error for clients.
   */
  constructor(message = "Read-only API key cannot call mutation routes") {
    super(message);
    this.name = "DashboardReadOnlyApiKeyError";
  }
}
