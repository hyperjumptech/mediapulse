export type SourceForGeneration = {
  url: string;
  title: string;
  content: string;
  author?: string | null;
  source?: string | null;
  /** ISO-8601 publish timestamp from agent-data-api when available. */
  publishedAt?: string | null;
};
