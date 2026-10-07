import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { renderNewsletterEmail } from "../index.js";
import Day1WelcomeIndonesianPreview from "./day1-welcome-id.js";
import {
  Day1WelcomeEmail,
  MAX_WELCOME_CLASSIFICATION_LEVELS,
  MAX_WELCOME_NAMED_ENTITIES,
  MAX_WELCOME_PEERS,
  MAX_WELCOME_STORIES,
  MAX_WELCOME_STORY_POINTS,
  formatStoryDate,
  type Day1WelcomeStory,
} from "./day1-welcome.js";

const withoutTextSeparators = (html: string): string =>
  html.replace(/<!-- -->/g, "");

const renderWelcome = async (
  props: Parameters<typeof Day1WelcomeEmail>[0],
): Promise<{ html: string; text: string }> => {
  const { html, text } = await renderNewsletterEmail({
    variant: "day1-welcome",
    ...props,
  });

  return { html: withoutTextSeparators(html), text };
};

const buildStory = (index: number, pointCount: number): Day1WelcomeStory => ({
  title: `Story number ${String(index)}`,
  url: `https://example.com/story-${String(index)}`,
  source: "Market Wire",
  points: Array.from(
    { length: pointCount },
    (_, pointIndex) =>
      `Story ${String(index)} point ${String(pointIndex + 1)}.`,
  ),
});

const MINIMAL_PROPS = {
  tickerSymbol: "ACME",
  companyName: "Acme Telekomunikasi",
};

describe("Day1WelcomeEmail", () => {
  it("opens with a neutral header holding only the ticker badge and company name", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const headingIndex = html.indexOf("Acme Telekomunikasi</h1>");
    const classificationIndex = html.indexOf(
      "Infrastructures · Telecommunication · Integrated Telecom",
    );

    expect(html).toContain(
      "A quick primer on Acme Telekomunikasi before your first issue",
    );
    expect(html).toContain(">ACME</p>");
    expect(headingIndex).toBeGreaterThan(-1);
    expect(html).not.toContain("Meet Acme");
    expect(html).not.toContain("Welcome to MediaPulse");
    expect(html).not.toContain("linear-gradient");
    expect(classificationIndex).toBeGreaterThan(
      html.indexOf("The company in brief"),
    );
    expect(html).toContain(
      "Thanks for following ACME. Here is a quick primer on the company",
    );
  });

  it("renders the stat strip from the knowledge base counts and the rival count", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).toContain(">128</p>");
    expect(html).toContain(">stories read</p>");
    expect(html).toContain(">46</p>");
    expect(html).toContain(">names tracked</p>");
    expect(html).toContain(">3</p>");
    expect(html).toContain(">rivals watched</p>");
  });

  it("uses singular stat labels and hides the strip when fewer than two stats exist", async () => {
    const singular = await renderWelcome({
      ...MINIMAL_PROPS,
      articlesRead: 1,
      namesTracked: 1,
      competitors: ["Contoso Mobile"],
    });
    const lonely = await renderWelcome({
      ...MINIMAL_PROPS,
      articlesRead: 0,
      namesTracked: 12,
    });

    expect(singular.html).toContain(">story read</p>");
    expect(singular.html).toContain(">name tracked</p>");
    expect(singular.html).toContain(">rival watched</p>");
    expect(lonely.html).not.toContain("names tracked");
  });

  it("renders the profile, competitor and regulator pills", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).toContain("The company in brief");
    expect(html).toContain("Integrated telecom operator serving mobile");
    expect(html).toContain("Sells prepaid and postpaid mobile plans");
    expect(html).toContain("Who it&#x27;s up against");
    expect(html).toContain(">Competes with</p>");
    expect(html).toContain(">Contoso Mobile</span>");
    expect(html).toContain(">Northwind Net</span>");
    expect(html).toContain(">Regulated by</p>");
    expect(html).toContain(">Financial Services Authority (OJK)</span>");
  });

  it("highlights the first story as the lead and lists the rest below it", async () => {
    const { html, text } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const leadLabelIndex = html.indexOf("Lead story");
    const leadTitleIndex = html.indexOf("Acme extends home-fiber lead");
    const secondTitleIndex = html.indexOf(
      "Acme holds full-year capex guidance",
    );

    expect(text).toMatch(/What's happening/i);
    expect(html).toContain("The latest ACME stories we have read.");
    expect(leadLabelIndex).toBeGreaterThan(-1);
    expect(leadTitleIndex).toBeGreaterThan(leadLabelIndex);
    expect(secondTitleIndex).toBeGreaterThan(leadTitleIndex);
    expect(html).toContain('href="https://example.com/acme/home-fiber"');
    expect(html).toContain("Market Wire</a> · 3 Oct 2026");
    expect(html).toContain(
      "Added roughly 320,000 home-fiber subscribers in the quarter.",
    );
  });

  it("draws one bar per named entity, scaled to the most mentioned one", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      inTheNews: [
        { name: "Contoso Mobile", articleCount: 14 },
        { name: "Ministry of Communication", articleCount: 9 },
        { name: "Rarely Mentioned", articleCount: 0 },
      ],
    });

    expect(html).toContain("Who shows up next to ACME");
    expect(html).toContain(
      "Names that appear most in ACME coverage, by article count.",
    );
    expect(html).toContain(">Contoso Mobile</p>");
    expect(html).toContain(">14 articles</p>");
    expect(html).toContain(">0 articles</p>");
    expect(html).toMatch(/width:100%/);
    expect(html).toMatch(/width:64%/);
    expect(html).toMatch(/width:4%/);
  });

  it("explains what happens next as three steps", async () => {
    const withTime = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const withoutTime = await renderWelcome(MINIMAL_PROPS);

    expect(withTime.html).toContain("What happens next");
    expect(withTime.html).toContain(">Today</p>");
    expect(withTime.html).toContain(">Every day at 9:00 AM WIB</p>");
    expect(withTime.html).toContain(">Only when it matters</p>");
    expect(withTime.html).toContain(
      "We read the latest ACME news and decide whether it is worth your time.",
    );
    expect(withoutTime.html).toContain(">Every day</p>");
  });

  it("renders the sign-off and the newsletter footer", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);

    expect(html).toContain("The MediaPulse Team");
    expect(html).toContain(
      "Have feedback? Reply to this email and we will use it to improve the newsletter.",
    );
    expect(html).toContain(
      "You are receiving this because you subscribed to ACME updates.",
    );
    expect(html).toContain("Unsubscribe from MediaPulse: ACME updates");
    expect(html).toContain("https://example.com/api/unsubscribe?token=preview");
  });

  it("still reads as a welcome when only the ticker and company name are known", async () => {
    const { html, text } = await renderWelcome({
      ...MINIMAL_PROPS,
      tickerSymbol: " ACME ",
    });

    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).toContain(">ACME</p>");
    expect(html).toContain("What happens next");
    expect(html).toContain("The MediaPulse Team");
    expect(html).not.toContain("The company in brief");
    expect(html).not.toContain("Who it&#x27;s up against");
    expect(html).not.toContain("Lead story");
    expect(text).not.toMatch(/What's happening/i);
    expect(html).not.toContain("Who shows up next to");
    expect(html).not.toContain("rivals watched");
    expect(html).not.toMatch(/unsubscribe/i);
  });

  it("drops blank profile values and shows only the groups that have data", async () => {
    const onlyBusinessAndRegulators = await renderWelcome({
      ...MINIMAL_PROPS,
      overview: "   ",
      businessOperation: "Sells mobile plans.",
      classification: ["", "  "],
      competitors: [" "],
      regulators: [" OJK "],
    });
    const onlyOverviewAndCompetitors = await renderWelcome({
      ...MINIMAL_PROPS,
      overview: "Telecom operator.",
      competitors: ["Contoso Mobile"],
    });
    const onlyClassification = await renderWelcome({
      ...MINIMAL_PROPS,
      classification: ["Infrastructures"],
    });

    expect(onlyBusinessAndRegulators.html).toContain("The company in brief");
    expect(onlyBusinessAndRegulators.html).toContain("Sells mobile plans.");
    expect(onlyBusinessAndRegulators.html).toContain(">OJK</span>");
    expect(onlyBusinessAndRegulators.html).not.toContain("Competes with");
    expect(onlyBusinessAndRegulators.html).not.toContain(" · ");
    expect(onlyOverviewAndCompetitors.html).toContain("Telecom operator.");
    expect(onlyOverviewAndCompetitors.html).toContain(">Contoso Mobile</span>");
    expect(onlyOverviewAndCompetitors.html).not.toContain("Regulated by");
    expect(onlyClassification.html).toContain("The company in brief");
    expect(onlyClassification.html).toContain(">Infrastructures</p>");
  });

  it("caps chips, stories, points per story, named entities and peers", async () => {
    const storyCount = MAX_WELCOME_STORIES + 2;
    const entityCount = MAX_WELCOME_NAMED_ENTITIES + 2;
    const peerCount = MAX_WELCOME_PEERS + 2;
    const levelCount = MAX_WELCOME_CLASSIFICATION_LEVELS + 1;

    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      articlesRead: 10,
      classification: Array.from(
        { length: levelCount },
        (_, index) => `Level ${String(index + 1)}`,
      ),
      competitors: Array.from(
        { length: peerCount },
        (_, index) => `Competitor ${String(index + 1)}`,
      ),
      regulators: Array.from(
        { length: peerCount },
        (_, index) => `Regulator ${String(index + 1)}`,
      ),
      recentStories: Array.from({ length: storyCount }, (_, index) =>
        buildStory(index + 1, MAX_WELCOME_STORY_POINTS + 1),
      ),
      inTheNews: Array.from({ length: entityCount }, (_, index) => ({
        name: `Entity ${String(index + 1)}`,
        articleCount: entityCount - index,
      })),
    });

    expect(html).toContain(
      `Level ${String(MAX_WELCOME_CLASSIFICATION_LEVELS)}</p>`,
    );
    expect(html).not.toContain(`Level ${String(levelCount)}`);
    expect(html).toContain(`Story number ${String(MAX_WELCOME_STORIES)}`);
    expect(html).not.toContain(
      `Story number ${String(MAX_WELCOME_STORIES + 1)}`,
    );
    expect(html).toContain(
      `Story 1 point ${String(MAX_WELCOME_STORY_POINTS)}.`,
    );
    expect(html).not.toContain(
      `Story 1 point ${String(MAX_WELCOME_STORY_POINTS + 1)}.`,
    );
    expect(html).toContain(`>Entity ${String(MAX_WELCOME_NAMED_ENTITIES)}<`);
    expect(html).not.toContain(
      `>Entity ${String(MAX_WELCOME_NAMED_ENTITIES + 1)}<`,
    );
    expect(html).toContain(`>Competitor ${String(MAX_WELCOME_PEERS)}<`);
    expect(html).not.toContain(`>Competitor ${String(MAX_WELCOME_PEERS + 1)}<`);
    expect(html).toContain(`>Regulator ${String(MAX_WELCOME_PEERS)}<`);
    expect(html).not.toContain(`>Regulator ${String(MAX_WELCOME_PEERS + 1)}<`);
    expect(html).toContain(`>${String(peerCount)}</p>`);
  });

  it("renders a headline-only lead story with the fallback link label and no date", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      recentStories: [
        {
          title: "Acme names a new chief executive",
          url: "https://example.com/acme/ceo",
          publishedAt: "not a date",
          points: [],
        },
      ],
      inTheNews: [{ name: "Contoso Mobile", articleCount: 1 }],
    });

    expect(html).toContain("Lead story");
    expect(html).toContain("Acme names a new chief executive");
    expect(html).toContain("Read the full article…</a></p>");
    expect(html).not.toContain("list-style-type:disc");
    expect(html).toContain(">1 article</p>");
  });

  it("localizes the chrome, counts and story dates in Indonesian", async () => {
    const { html } = await renderWelcome({
      ...Day1WelcomeEmail.PreviewProps,
      articlesRead: 1280,
      reviewTimeLabel: "09.00 WIB",
      language: "id",
    });

    expect(html).toContain(
      "Gambaran singkat Acme Telekomunikasi sebelum edisi pertama Anda",
    );
    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).not.toContain("Mengenal");
    expect(html).toContain(">1.280</p>");
    expect(html).toContain(">berita dibaca</p>");
    expect(html).toContain(">nama dipantau</p>");
    expect(html).toContain(">pesaing dipantau</p>");
    expect(html).toContain("Sekilas perusahaan");
    expect(html).toContain("Lawan dan pengawas");
    expect(html).toContain(">Bersaing dengan</p>");
    expect(html).toContain(">Diatur oleh</p>");
    expect(html).toContain("Kabar terbaru");
    expect(html).toContain("Berita utama");
    expect(html).toContain("Market Wire</a> · 3 Okt 2026");
    expect(html).toContain("Yang sering muncul bersama ACME");
    expect(html).toContain(">14 artikel</p>");
    expect(html).toContain("Selanjutnya");
    expect(html).toContain(">Setiap hari pukul 09.00 WIB</p>");
    expect(html).toContain(">Hanya saat penting</p>");
    expect(html).toContain("Tim MediaPulse");
    expect(html).toContain("Berhenti berlangganan pembaruan MediaPulse: ACME");
    expect(html).not.toContain("What happens next");
  });

  it("uses the Indonesian daily step without a review time", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      language: "id",
    });

    expect(html).toContain(">Setiap hari</p>");
  });

  it("formats English counts with thousands separators", async () => {
    const { html } = await renderWelcome({
      ...MINIMAL_PROPS,
      articlesRead: 1280,
      namesTracked: 46,
    });

    expect(html).toContain(">1,280</p>");
  });

  it("keeps a dark-mode marker class on every element that carries a color", async () => {
    const { html } = await renderWelcome(Day1WelcomeEmail.PreviewProps);
    const cardStart = html.indexOf('class="email-card');
    const cardHtml = html.slice(cardStart);
    const coloredTags = [
      ...cardHtml.matchAll(/<[a-z0-9]+[^>]*style="[^"]*color:[^"]*"[^>]*>/g),
    ].map((match) => match[0]);
    const unmarkedTags = coloredTags.filter(
      (tag) => !/class="[^"]*\b(e-[a-z-]+|email-card)\b/.test(tag),
    );

    expect(coloredTags.length).toBeGreaterThan(0);
    expect(unmarkedTags).toEqual([]);
  });
});

describe("formatStoryDate", () => {
  it("formats the date in Jakarta time", () => {
    const englishDate = formatStoryDate("2026-10-02T18:30:00.000Z", "en");
    const indonesianDate = formatStoryDate("2026-10-02T18:30:00.000Z", "id");

    expect(englishDate).toBe("3 Oct 2026");
    expect(indonesianDate).toBe("3 Okt 2026");
  });

  it("returns undefined for a missing or unparseable date", () => {
    const missingDate = formatStoryDate(undefined, "en");
    const unparseableDate = formatStoryDate("yesterday-ish", "en");

    expect(missingDate).toBeUndefined();
    expect(unparseableDate).toBeUndefined();
  });
});

describe("Day1WelcomeIndonesianPreview", () => {
  it("renders the welcome preview in Indonesian", async () => {
    const html = await render(
      <Day1WelcomeIndonesianPreview
        {...Day1WelcomeIndonesianPreview.PreviewProps}
      />,
    );

    expect(html).toContain("Acme Telekomunikasi</h1>");
    expect(html).toContain("Infrastruktur");
  });
});
