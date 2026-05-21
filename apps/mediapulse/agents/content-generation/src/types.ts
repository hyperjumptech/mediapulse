export type SourceForGeneration = {
  url: string;
  title: string;
  content: string;
  /** ISO-8601 publish timestamp from agent-data-api when available. */
  publishedAt?: string | null;
};
