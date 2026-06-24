import {
  runQualityGate,
  type QualityDecision,
} from "@workspace/agent-ingestion";

/**
 * Drops empty, too-short, or non-article pages via the shared content-quality gate.
 *
 * @param title - Page title.
 * @param content - Fetched page body.
 * @param url - Page URL (used by some quality rules).
 */
export const checkContent = (
  title: string,
  content: string,
  url = "",
): QualityDecision => runQualityGate(title, content, url);
