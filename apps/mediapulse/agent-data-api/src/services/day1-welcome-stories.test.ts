/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadWelcomeStories,
  selectWelcomeStories,
  type WelcomeStoriesDb,
} from "./day1-welcome-stories.js";

const article = (
  slug: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  title: `Story ${slug}`,
  source: "Kontan",
  url: `https://example.com/${slug}`,
  points: [`${slug} point one`, `${slug} point two`, `${slug} point three`],
  ...overrides,
});

const issueDocument = (...articles: Record<string, unknown>[]): string =>
  JSON.stringify({
    version: 1,
    sections: [{ key: "issuer-news", articles }],
  });

describe("selectWelcomeStories", () => {
  it("takes stories from the newest issue first, in document order, with two points each", () => {
    const stories = selectWelcomeStories([
      {
        content: issueDocument(article("a"), article("b")),
        publishedAtByUrl: new Map([
          ["https://example.com/b", new Date("2026-10-13T02:00:00.000Z")],
        ]),
      },
      {
        content: issueDocument(article("c")),
        publishedAtByUrl: new Map(),
      },
    ]);

    expect(stories).toEqual([
      {
        title: "Story a",
        url: "https://example.com/a",
        source: "Kontan",
        points: ["a point one", "a point two"],
      },
      {
        title: "Story b",
        url: "https://example.com/b",
        source: "Kontan",
        publishedAt: "2026-10-13T02:00:00.000Z",
        points: ["b point one", "b point two"],
      },
      {
        title: "Story c",
        url: "https://example.com/c",
        source: "Kontan",
        points: ["c point one", "c point two"],
      },
    ]);
  });

  it("keeps a story that ran in two issues once", () => {
    const stories = selectWelcomeStories([
      { content: issueDocument(article("a")), publishedAtByUrl: new Map() },
      {
        content: issueDocument(article("a", { title: "Older copy" })),
        publishedAtByUrl: new Map(),
      },
    ]);

    expect(stories.map((story) => story.title)).toEqual(["Story a"]);
  });

  it("stops at four stories", () => {
    const stories = selectWelcomeStories([
      {
        content: issueDocument(article("a"), article("b"), article("c")),
        publishedAtByUrl: new Map(),
      },
      {
        content: issueDocument(article("d"), article("e")),
        publishedAtByUrl: new Map(),
      },
    ]);

    expect(stories.map((story) => story.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/d",
    ]);
  });

  it("skips issues without a document in the reader's language", () => {
    const stories = selectWelcomeStories([
      { content: null, publishedAtByUrl: new Map() },
      { content: "plain text body", publishedAtByUrl: new Map() },
      { content: issueDocument(article("a")), publishedAtByUrl: new Map() },
    ]);

    expect(stories.map((story) => story.url)).toEqual([
      "https://example.com/a",
    ]);
  });

  it("leaves out the source when the article names none", () => {
    const stories = selectWelcomeStories([
      {
        content: issueDocument(article("a", { source: undefined })),
        publishedAtByUrl: new Map(),
      },
    ]);

    expect(stories[0]).not.toHaveProperty("source");
  });
});

describe("loadWelcomeStories", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const newsletterRow = {
    content: issueDocument(article("en")),
    translations: [{ content: issueDocument(article("id")) }],
    sections: [
      {
        items: [
          {
            url: "https://example.com/id",
            dataSource: { publishedAt: new Date("2026-10-12T01:00:00.000Z") },
          },
          { url: null, dataSource: null },
        ],
      },
    ],
  };

  it("reads the last three issues from the past fourteen days", async () => {
    const findMany = vi.fn().mockResolvedValue([newsletterRow]);
    const db = { newsletter: { findMany } } as unknown as WelcomeStoriesDb;

    await loadWelcomeStories(db, {
      tickerId: "ticker-1",
      language: "id",
      now: new Date("2026-10-14T00:00:00.000Z"),
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tickerId: "ticker-1",
          createdAt: { gte: new Date("2026-09-30T00:00:00.000Z") },
          translations: { some: { language: "id" } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    );
    expect(findMany.mock.calls[0]?.[0].select.translations).toEqual({
      where: { language: "id" },
      select: { content: true },
    });
  });

  it("uses the translated document and its publish dates for an Indonesian reader", async () => {
    const db = {
      newsletter: { findMany: vi.fn().mockResolvedValue([newsletterRow]) },
    } as unknown as WelcomeStoriesDb;

    const stories = await loadWelcomeStories(db, {
      tickerId: "ticker-1",
      language: "id",
      now: new Date("2026-10-14T00:00:00.000Z"),
    });

    expect(stories).toEqual([
      expect.objectContaining({
        url: "https://example.com/id",
        publishedAt: "2026-10-12T01:00:00.000Z",
      }),
    ]);
  });

  it("uses the English document for an English reader", async () => {
    const findMany = vi.fn().mockResolvedValue([newsletterRow]);
    const db = { newsletter: { findMany } } as unknown as WelcomeStoriesDb;

    const stories = await loadWelcomeStories(db, {
      tickerId: "ticker-1",
      language: "en",
      now: new Date("2026-10-14T00:00:00.000Z"),
    });

    expect(stories.map((story) => story.url)).toEqual([
      "https://example.com/en",
    ]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      tickerId: "ticker-1",
      createdAt: { gte: new Date("2026-09-30T00:00:00.000Z") },
    });
  });
});
