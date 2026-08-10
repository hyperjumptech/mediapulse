export type SourceForGeneration = {
  dataSourceId?: string;
  url: string;
  title: string;
  content: string;
  author?: string | null;
  source?: string | null;
  /** ISO-8601 publish timestamp from agent-data-api when available. */
  publishedAt?: string | null;
  /** Newsletter section pre-assigned by article-analysis 3.0.0 (authoritative). */
  section?: string | null;
  /** Section-fit score 0–1 from article-analysis 3.0.0. */
  sectionScore?: number | null;
  /** Cached publisher authority 0–10; breaks ties between equal section fit only. */
  publisherAuthority?: number | null;
};
