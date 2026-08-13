import { beforeEach, describe, expect, it, vi } from "vitest";

import { anchorsFor, type StorylineSnapshot } from "./attach.js";
import {
  ingestCandidates,
  type IngestCandidate,
  type KnowledgeStore,
} from "./ingest.js";

const unlocked = (storylineId: string, developmentId: string | null) => ({
  storylineId,
  developmentId,
  locked: false,
  lockedReason: null,
});

const snapshotFrom = (
  articles: readonly { title: string; text: string }[],
): StorylineSnapshot => {
  const developments = articles.map((article, index) => {
    const anchors = anchorsFor({ dataSourceId: `seed-${index}`, ...article });

    return {
      id: `dev-${index}`,
      anchors: anchors.anchors,
      titleAnchors: anchors.titleAnchors,
      figures: anchors.figures,
      day: "2026-06-29",
    };
  });
  const union = new Set<string>();
  for (const development of developments) {
    for (const anchor of development.anchors) {
      union.add(anchor);
    }
  }

  return {
    id: "story-1",
    anchors: union,
    tickerCount: 1,
    locked: false,
    developments,
  };
};

const createStore = (storylines: StorylineSnapshot[] = []) => {
  const store: KnowledgeStore = {
    findStorylinesByAnchors: vi.fn(async () => storylines),
    openStoryline: vi.fn(async () => unlocked("story-new", "dev-new")),
    openDevelopment: vi.fn(async () => unlocked("story-1", "dev-next")),
    cite: vi.fn(async () => unlocked("story-1", "dev-0")),
  };

  return store as KnowledgeStore & {
    findStorylinesByAnchors: ReturnType<typeof vi.fn>;
    openStoryline: ReturnType<typeof vi.fn>;
    openDevelopment: ReturnType<typeof vi.fn>;
    cite: ReturnType<typeof vi.fn>;
  };
};

const ANNOUNCEMENT = {
  dataSourceId: "ds-1",
  title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
  text: "Telkom Indonesia memangkas jumlah anak usaha dari 67 menjadi 19 entitas menuju strategic holding.",
};

const SECOND_OUTLET = {
  dataSourceId: "ds-2",
  title: "Telkom Pangkas Anak Usaha Jadi 19 Entitas",
  text: "Telkom Indonesia memangkas anak usaha dari 67 menjadi 19 entitas dalam transformasi strategic holding.",
};

const candidate = (
  overrides: Partial<IngestCandidate> & { dataSourceId: string; title: string },
): IngestCandidate => ({
  text: "",
  observedAt: "2026-06-29T00:00:00.000Z",
  tickerIds: ["ticker-tlkm"],
  ...overrides,
});

describe("ingestCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a storyline when nothing matches", async () => {
    const store = createStore();

    const tally = await ingestCandidates([candidate(ANNOUNCEMENT)], store);

    expect(tally.storylinesOpened).toBe(1);
    expect(tally.developmentsOpened).toBe(1);
    expect(store.openStoryline).toHaveBeenCalledTimes(1);
  });

  it("cites an existing move when a second outlet reports it", async () => {
    const store = createStore([snapshotFrom([ANNOUNCEMENT])]);

    const tally = await ingestCandidates([candidate(SECOND_OUTLET)], store);

    expect(tally.citationsAdded).toBe(1);
    expect(store.cite).toHaveBeenCalledTimes(1);
    expect(store.openDevelopment).not.toHaveBeenCalled();
  });

  it("skips an article with no distinctive anchors", async () => {
    const store = createStore();

    const tally = await ingestCandidates(
      [candidate({ dataSourceId: "ds-1", title: "PT", text: "" })],
      store,
    );

    expect(tally.skippedNoAnchors).toBe(1);
    expect(store.openStoryline).not.toHaveBeenCalled();
  });

  it("counts a locked storyline once even when several writes report it", async () => {
    const store = createStore();
    store.openStoryline.mockResolvedValue({
      storylineId: "story-1",
      developmentId: "dev-1",
      locked: true,
      lockedReason: "spans 6 tickers, over the ceiling of 5",
    });

    const tally = await ingestCandidates(
      [
        candidate(ANNOUNCEMENT),
        candidate({ ...ANNOUNCEMENT, dataSourceId: "ds-9" }),
      ],
      store,
    );

    expect(tally.storylinesLocked).toBe(1);
  });

  it("passes the attach evidence through to the writer", async () => {
    const store = createStore([snapshotFrom([ANNOUNCEMENT])]);

    await ingestCandidates(
      [
        candidate({
          dataSourceId: "ds-3",
          title: "Telkom Tuntaskan Streamlining 10 Anak Usaha Entitas",
          text: "Telkom Indonesia menuntaskan streamlining 10 anak usaha entitas senilai Rp2,4 triliun menuju strategic holding.",
        }),
      ],
      store,
    );

    expect(store.openDevelopment).toHaveBeenCalledWith(
      expect.objectContaining({
        storylineId: "story-1",
        evidence: expect.objectContaining({ path: "body" }),
      }),
    );
  });
});
