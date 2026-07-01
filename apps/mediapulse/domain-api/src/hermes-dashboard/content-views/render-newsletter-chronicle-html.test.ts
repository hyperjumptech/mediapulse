import { describe, expect, it, vi } from "vitest";

import {
  buildChronicle,
  type BuildChronicleDeps,
} from "../../resources/newsletters/build-chronicle";
import { renderNewsletterChronicleHtml } from "./render-newsletter-chronicle-html";

const NEWSLETTER = {
  id: "nl-1",
  tickerId: "tk-1",
  subject: "BBRI daily brief <script>",
  createdAt: new Date("2026-06-30T06:05:00.000Z"),
  model: "gpt-4o",
  promptTokens: 14_200,
  completionTokens: 3_050,
  totalTokens: 17_250,
};

const emptyDeps: BuildChronicleDeps = {
  searchQuerySet: { findMany: vi.fn().mockResolvedValue([]) },
  dataCollectionRun: { findMany: vi.fn().mockResolvedValue([]) },
  dataSourceTickerSection: { findMany: vi.fn().mockResolvedValue([]) },
  articleAnalysisRun: { findMany: vi.fn().mockResolvedValue([]) },
  contentGenerationRun: { findFirst: vi.fn().mockResolvedValue(null) },
  deliveryRun: { findMany: vi.fn().mockResolvedValue([]) },
};

describe("renderNewsletterChronicleHtml", () => {
  it("renders all six stage labels and escapes the subject", async () => {
    const chronicle = await buildChronicle(NEWSLETTER, emptyDeps);
    const html = renderNewsletterChronicleHtml(chronicle);

    expect(html).toContain("Query Analysis");
    expect(html).toContain("Page Collection");
    expect(html).toContain("Data Collection");
    expect(html).toContain("Article Analysis");
    expect(html).toContain("Content Generation");
    expect(html).toContain("Delivery");
    // Subject is HTML-escaped (no raw <script>).
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders a failed content-generation stage with its error message", async () => {
    const chronicle = await buildChronicle(NEWSLETTER, {
      ...emptyDeps,
      contentGenerationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cgr-1",
          outcome: "failed",
          stage: "validate",
          errorCode: "validation_failed",
          errorCategory: "schema",
          message: "section 'Earnings' produced 0 bullets",
          durationMs: 2_100,
          createdAt: new Date("2026-06-30T06:05:04.000Z"),
          details: null,
        }),
      },
    });
    const html = renderNewsletterChronicleHtml(chronicle);

    expect(html).toContain("validation_failed");
    expect(html).toContain("section 'Earnings' produced 0 bullets");
  });
});
