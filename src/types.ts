export type PoolArticle = {
  dataSourceId: string;
  url: string;
  title: string;
  content: string;
  contentIsDescriptionOnly: boolean;
  author: string | null;
  source: string | null;
  publishedAt: string | null;
  section: string | null;
  sectionScore: number | null;
  publisherAuthority: number | null;
};

export type ShippedItem = {
  title: string;
  points: string[];
  url: string;
  dataSourceId: string | null;
  sectionKey: string;
};

export type EvalCase = {
  case_id: string;
  symbol: string;
  stratum: "dcii" | "big_pool" | "mid_pool" | "figure_drop";
  pool_size: number;
  run_at: string;
  shipped_subject: string;
  aliases: string[];
  ticker_name: string | null;
  competitors: { name: string; aliases?: string[] }[] | null;
  brief: string | null;
  recent_bullets: { sectionKey: string; bulletText: string }[] | null;
  pool: PoolArticle[];
  shipped_items: ShippedItem[] | null;
};

export type SummarizerCall = {
  articleTitle: string;
  prompt: string;
  rawSummary: { title: string; points: string[] };
};
