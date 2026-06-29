/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletterTranslation: { upsert: vi.fn() },
  },
}));

describe("createNewsletterTranslation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts a translation keyed on newsletter id + language with provenance", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterTranslation.upsert).mockResolvedValue(
      {} as unknown as Awaited<
        ReturnType<typeof prisma.newsletterTranslation.upsert>
      >,
    );

    const { createNewsletterTranslation } =
      await import("./newsletter-translation.js");
    await createNewsletterTranslation({
      newsletterId: "11111111-1111-4111-8111-111111111111",
      language: "id",
      subject: "Subjek",
      content: "Isi",
      model: "gpt-4o-mini",
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
    });

    expect(prisma.newsletterTranslation.upsert).toHaveBeenCalledWith({
      where: {
        newsletterId_language: {
          newsletterId: "11111111-1111-4111-8111-111111111111",
          language: "id",
        },
      },
      create: {
        newsletterId: "11111111-1111-4111-8111-111111111111",
        language: "id",
        subject: "Subjek",
        content: "Isi",
        model: "gpt-4o-mini",
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      },
      update: {
        subject: "Subjek",
        content: "Isi",
        model: "gpt-4o-mini",
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      },
    });
  });

  it("defaults optional provenance fields to null", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterTranslation.upsert).mockResolvedValue(
      {} as unknown as Awaited<
        ReturnType<typeof prisma.newsletterTranslation.upsert>
      >,
    );

    const { createNewsletterTranslation } =
      await import("./newsletter-translation.js");
    await createNewsletterTranslation({
      newsletterId: "22222222-2222-4222-8222-222222222222",
      language: "id",
      subject: "S",
      content: "C",
    });

    const callArg = vi.mocked(prisma.newsletterTranslation.upsert).mock
      .calls[0]?.[0];
    expect(callArg?.create).toMatchObject({
      model: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
  });
});
