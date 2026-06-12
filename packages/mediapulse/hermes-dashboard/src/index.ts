/**
 * @mediapulse/hermes-dashboard — Mediapulse-specific MCP tool specs and server helpers.
 * Operator UI is served by domain-api HTTP content views declared in the Hermes manifest.
 */

export {
  MEDIAPULSE_CGA_READ_TOOL_SPECS,
  type MediapulseMcpReadToolSpec,
} from "./mcp-read-tool-specs";

export {
  listContentGenerationRuns,
  getContentGenerationRunById,
} from "./lib/content-generation-runs-api";
export { getAgentInsights } from "./lib/agent-insights-api";
export { getSectionCoverageRollupForTicker } from "./lib/section-coverage-rollup";
export { createMediapulseAgentDataApiClient } from "./lib/agent-data-api-client";
