import { describe, it, expect, vi } from "vitest";
import type got from "got";

import { rssStrategy } from "./rss";
import { RateLimiter } from "../resilience";

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Article One</title>
      <link>https://example.com/articles/one</link>
      <description>Summary of article one</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/articles/two</link>
      <description>Summary of article two</description>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry One</title>
    <link href="https://example.com/atom/one" rel="alternate"/>
    <summary>Summary of atom entry one</summary>
    <updated>2024-03-15T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link href="https://example.com/atom/two"/>
    <updated>2024-03-16T12:00:00Z</updated>
  </entry>
</feed>`;

const MALFORMED_XML = `<?xml version="1.0"?><unclosed>`;

const HTML_DESCRIPTION_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Markup Feed</title>
    <item>
      <title>Article With Image</title>
      <link>https://example.com/articles/image</link>
      <description>&lt;img src="https://cdn.example.com/photo.jpeg?w=360&amp;amp;q=90"/&gt; Harga batu bara menguat pada perdagangan hari ini.</description>
    </item>
    <item>
      <title>Anchor Only</title>
      <link>https://example.com/articles/anchor</link>
      <description>&lt;a href="https://news.example.com/rss/articles/CBMi"&gt;Anchor Only&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;example.com&lt;/font&gt;</description>
    </item>
  </channel>
</rss>`;

const buildDeps = (body: string) => ({
  gotClient: {
    get: vi.fn().mockResolvedValue({ statusCode: 200, body }),
  } as unknown as typeof got,
  rateLimiter: new RateLimiter(100, 1),
  logger: { info: vi.fn(), warn: vi.fn() },
});

describe("rssStrategy", () => {
  it("parses RSS 2.0 items with title, summary and publishedAt", async () => {
    const deps = buildDeps(RSS_FIXTURE);
    const items = await rssStrategy.discover(
      "https://example.com/feed.rss",
      deps,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://example.com/articles/one",
      title: "Article One",
      summary: "Summary of article one",
    });
    expect(items[0]?.publishedAt).toBe(
      new Date("Mon, 01 Jan 2024 00:00:00 GMT").toISOString(),
    );
  });

  it("parses Atom feed entries with title, summary and publishedAt", async () => {
    const deps = buildDeps(ATOM_FIXTURE);
    const items = await rssStrategy.discover(
      "https://example.com/feed.atom",
      deps,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://example.com/atom/one",
      title: "Atom Entry One",
      summary: "Summary of atom entry one",
      publishedAt: "2024-03-15T10:00:00.000Z",
    });
    expect(items[1]).toMatchObject({
      url: "https://example.com/atom/two",
      title: "Atom Entry Two",
      publishedAt: "2024-03-16T12:00:00.000Z",
    });
    expect(items[1]?.summary).toBeUndefined();
  });

  it("reduces HTML in item descriptions to plain text", async () => {
    const deps = buildDeps(HTML_DESCRIPTION_FIXTURE);
    const items = await rssStrategy.discover(
      "https://example.com/feed.rss",
      deps,
    );

    expect(items[0]?.summary).toBe(
      "Harga batu bara menguat pada perdagangan hari ini.",
    );
    expect(items[1]?.summary).toBe("Anchor Only example.com");
  });

  it("throws a classified error on malformed XML", async () => {
    const deps = buildDeps(MALFORMED_XML);
    await expect(
      rssStrategy.discover("https://example.com/bad-feed.xml", deps),
    ).rejects.toMatchObject({ errorCategory: "provider_data_invalid" });
  });

  it("throws a classified error when the XML is not an RSS or Atom feed", async () => {
    const deps = buildDeps("<html><body>Not a feed</body></html>");
    await expect(
      rssStrategy.discover("https://example.com/not-feed", deps),
    ).rejects.toMatchObject({ errorCategory: "provider_data_invalid" });
  });
});
