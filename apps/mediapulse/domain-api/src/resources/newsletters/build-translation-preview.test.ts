import { describe, expect, it, vi } from "vitest";

import { buildTranslationPreview } from "./build-translation-preview";

const DOCUMENT_BODY = JSON.stringify({
  version: 1,
  sections: [
    {
      key: "industry-pulse",
      articles: [
        {
          title: "Pendapatan broadband tetap datar",
          source: "Market Wire",
          url: "https://example.com/broadband",
          points: ["Penambahan pelanggan menopang pertumbuhan."],
        },
      ],
    },
  ],
});

describe("buildTranslationPreview", () => {
  it("renders the stored translation in the requested language", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      subject: "TLKM Pulse: Ringkasan mingguan",
      content: DOCUMENT_BODY,
    });
    const renderHtml = vi.fn().mockResolvedValue({ html: "<p>Pratinjau</p>" });

    const html = await buildTranslationPreview("nl-1", "TLKM", "id", {
      newsletterTranslation: { findUnique },
      renderHtml,
    });

    expect(html).toBe("<p>Pratinjau</p>");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          newsletterId_language: { newsletterId: "nl-1", language: "id" },
        },
      }),
    );
    expect(renderHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ringkasan mingguan",
        bodyText: DOCUMENT_BODY,
        tickerSymbol: "TLKM",
        language: "id",
      }),
    );
  });

  it("returns null without rendering when no translation exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const renderHtml = vi.fn();

    const html = await buildTranslationPreview("nl-2", "AAPL", "id", {
      newsletterTranslation: { findUnique },
      renderHtml,
    });

    expect(html).toBeNull();
    expect(renderHtml).not.toHaveBeenCalled();
  });

  it("returns a safe placeholder when the translation fails to render", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      subject: "TLKM Pulse: Ringkasan mingguan",
      content: DOCUMENT_BODY,
    });
    const renderHtml = vi.fn().mockRejectedValue(new Error("Template broke"));
    const warn = vi.fn();

    const html = await buildTranslationPreview("nl-3", "TLKM", "id", {
      newsletterTranslation: { findUnique },
      renderHtml,
      logger: { warn },
    });

    expect(html).toContain("<p>Email preview unavailable");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
