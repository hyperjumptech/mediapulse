/** Stable identity for the lifetime of this agent. */
export const AGENT_ID = "knowledge-ingestion";

/**
 * Incremented when the agent's behaviour changes.
 *
 * 1.0.0 replaced storyline attachment with entity extraction. The input gained a required
 * `tickerId` and the config gained the model credentials, so a pipeline step pinned to 0.1.0 is
 * describing an agent that no longer exists.
 */
export const AGENT_VERSION = "1.0.0";
