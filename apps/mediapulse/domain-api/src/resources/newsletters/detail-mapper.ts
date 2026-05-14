import type { Prisma } from "@mediapulse/database";
import type { NewsletterCitation } from "@workspace/email-templates/parse-newsletter-citations";

import type { ActiveQuerySetPayload } from "./active-query-set";
import type { HermesLinksPayload } from "./build-hermes-links";
import type { RecipientPayload } from "./build-recipients";
import type { SelectedSourcePayload } from "./build-selected-sources";

/** Row shape passed to {@link mapRowToDetailItem}. */
export type NewsletterDetailRow = Prisma.NewsletterGetPayload<{
  include: { ticker: { select: { id: true; symbol: true; name: true } } };
}>;

/**
 * Shape of the detail payload exposed by `GET /resources/newsletters/:id`.
 *
 * `title`/`subject` are duplicated so the generic dashboard detail page (which
 * looks for `row.title` first, then `row.subject`) picks the right header.
 *
 * `recipientsTruncated` flips to `true` when more than the cap exist (see
 * {@link buildRecipients}).
 */
export type DetailItem = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  tickerId: string;
  tickerSymbol: string;
  tickerName: string;
  createdAt: string;
  updatedAt: string;
  model: string | null;
  agentVersion: string | null;
  configVersion: string | null;
  promptHash: string | null;
  configSnapshotId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  content: string;
  citations: NewsletterCitation[];
  recipients: RecipientPayload[];
  recipientsTruncated: boolean;
  recipientsCap: number;
  selectedSources: SelectedSourcePayload[];
  selectedSourcesWindow: { start: string; end: string };
  activeQuerySet: ActiveQuerySetPayload;
  hermesLinks: HermesLinksPayload;
};

/**
 * Maps a newsletter row plus already-built sub-payloads to the detail response.
 *
 * @param row - Newsletter with ticker joined.
 * @param parts - Pre-built sub-payloads built by the helpers in this folder.
 */
export const mapRowToDetailItem = (
  row: NewsletterDetailRow,
  parts: {
    citations: NewsletterCitation[];
    recipients: RecipientPayload[];
    recipientsTruncated: boolean;
    recipientsCap: number;
    selectedSources: SelectedSourcePayload[];
    selectedSourcesWindow: { start: string; end: string };
    activeQuerySet: ActiveQuerySetPayload;
    hermesLinks: HermesLinksPayload;
  },
): DetailItem => ({
  id: row.id,
  title: row.subject,
  subject: row.subject,
  description: row.description,
  tickerId: row.tickerId,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  model: row.model,
  agentVersion: row.agentVersion,
  configVersion: row.configVersion,
  promptHash: row.promptHash,
  configSnapshotId: row.configSnapshotId,
  promptTokens: row.promptTokens,
  completionTokens: row.completionTokens,
  totalTokens: row.totalTokens,
  content: row.content,
  citations: parts.citations,
  recipients: parts.recipients,
  recipientsTruncated: parts.recipientsTruncated,
  recipientsCap: parts.recipientsCap,
  selectedSources: parts.selectedSources,
  selectedSourcesWindow: parts.selectedSourcesWindow,
  activeQuerySet: parts.activeQuerySet,
  hermesLinks: parts.hermesLinks,
});

/** Prisma include for the detail fetch. */
export const detailInclude = {
  ticker: { select: { id: true, symbol: true, name: true } },
} satisfies Prisma.NewsletterInclude;
