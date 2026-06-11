/** Default cap for DataQueue `invoke_agent` job timeout (abort + supervisor reclaim). */
export const DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS = 1_800_000;

/**
 * Caps the DataQueue job-level timeout so a hung agent invoke cannot block the processor batch
 * for the full agent HTTP deadline (which may be hours).
 *
 * - Important: every `invoke_agent` enqueue path (schedule, HTTP trigger, manual run) must apply
 *   this cap. The DataQueue processor runs a serialized batch loop, so one job left running for the
 *   full agent deadline stalls all other pending jobs (including other pipelines) until it settles.
 *
 * @param agentTimeoutMs - Agent HTTP timeout from pipeline/schedule config.
 * @param capMs - Optional override cap in milliseconds.
 * @returns Min of agent timeout and cap.
 */
export const resolveInvokeAgentJobTimeoutMs = (
  agentTimeoutMs: number,
  capMs?: number,
): number =>
  Math.min(agentTimeoutMs, capMs ?? DEFAULT_INVOKE_AGENT_JOB_TIMEOUT_MS);
