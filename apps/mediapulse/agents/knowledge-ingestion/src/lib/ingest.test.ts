import { beforeEach, describe, expect, it } from "vitest";

import { anchorsFor, type StorylineSnapshot } from "./attach.js";
import {
  ingestCandidates,
  type IngestCandidate,
  type KnowledgeStore,
} from "./ingest.js";

type StoredDevelopment = {
  id: string;
  anchors: Set<string>;
  titleAnchors: Set<string>;
  figures: Set<string>;
  day?: string;
  citations: string[];
};

type StoredStoryline = {
  id: string;
  name: string;
  anchors: Set<string>;
  locked: boolean;
  lockedReason: string | null;
  tickerIds: Set<string>;
  developments: StoredDevelopment[];
};

const createMemoryStore = () => {
  const storylines: StoredStoryline[] = [];
  let sequence = 0;

  const snapshot = (storyline: StoredStoryline): StorylineSnapshot => ({
    id: storyline.id,
    anchors: storyline.anchors,
    tickerCount: storyline.tickerIds.size,
    locked: storyline.locked,
    developments: storyline.developments.map((development) => ({
      id: development.id,
      anchors: development.anchors,
      titleAnchors: development.titleAnchors,
      figures: development.figures,
      day: development.day,
    })),
  });

  const store: KnowledgeStore = {
    findStorylinesByAnchors: async (anchors) =>
      storylines
        .filter((storyline) =>
          anchors.some((anchor) => storyline.anchors.has(anchor)),
        )
        .map(snapshot),

    openStoryline: async (command) => {
      sequence += 1;
      const id = `story-${sequence}`;
      const figures = anchorsFor({
        dataSourceId: command.dataSourceId,
        title: command.title,
        text: "",
      }).figures;
      storylines.push({
        id,
        name: command.name,
        anchors: new Set(command.anchors),
        locked: false,
        lockedReason: null,
        tickerIds: new Set(command.tickerIds),
        developments: [
          {
            id: `${id}-dev-1`,
            anchors: new Set(command.anchors),
            titleAnchors: new Set(command.titleAnchors),
            figures,
            citations: [command.dataSourceId],
          },
        ],
      });

      return id;
    },

    openDevelopment: async (command) => {
      const storyline = storylines.find(
        (item) => item.id === command.storylineId,
      );
      if (storyline === undefined) {
        throw new Error(`unknown storyline ${command.storylineId}`);
      }
      const id = `${storyline.id}-dev-${storyline.developments.length + 1}`;
      storyline.developments.push({
        id,
        anchors: new Set(command.anchors),
        titleAnchors: new Set(command.titleAnchors),
        figures: new Set(),
        citations: [command.dataSourceId],
      });
      for (const anchor of command.anchors) {
        storyline.anchors.add(anchor);
      }
      for (const tickerId of command.tickerIds) {
        storyline.tickerIds.add(tickerId);
      }

      return id;
    },

    cite: async (command) => {
      const storyline = storylines.find(
        (item) => item.id === command.storylineId,
      );
      const development = storyline?.developments.find(
        (item) => item.id === command.developmentId,
      );
      if (storyline === undefined || development === undefined) {
        throw new Error("unknown development");
      }
      development.citations.push(command.dataSourceId);
      for (const tickerId of command.tickerIds) {
        storyline.tickerIds.add(tickerId);
      }
    },

    tickerCountFor: async (storylineId) =>
      storylines.find((item) => item.id === storylineId)?.tickerIds.size ?? 0,

    developmentCountFor: async (storylineId) =>
      storylines.find((item) => item.id === storylineId)?.developments.length ??
      0,

    lockStoryline: async (storylineId, reason) => {
      const storyline = storylines.find((item) => item.id === storylineId);
      if (storyline !== undefined) {
        storyline.locked = true;
        storyline.lockedReason = reason;
      }
    },
  };

  return { store, storylines };
};

const candidate = (
  overrides: Partial<IngestCandidate> & { dataSourceId: string; title: string },
): IngestCandidate => ({
  text: "",
  observedAt: new Date("2026-06-29T00:00:00Z"),
  tickerIds: ["ticker-tlkm"],
  ...overrides,
});

describe("ingestCandidates", () => {
  let memory: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    memory = createMemoryStore();
  });

  it("opens one storyline and one development for a first article", async () => {
    const tally = await ingestCandidates(
      [
        candidate({
          dataSourceId: "ds-1",
          title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
          text: "Telkom Indonesia memangkas jumlah anak usaha dari 67 menjadi 19 entitas menuju strategic holding.",
        }),
      ],
      memory.store,
    );

    expect(tally.storylinesOpened).toBe(1);
    expect(tally.developmentsOpened).toBe(1);
    expect(memory.storylines).toHaveLength(1);
  });

  it("collapses a second outlet onto the same move instead of counting it twice", async () => {
    const tally = await ingestCandidates(
      [
        candidate({
          dataSourceId: "ds-1",
          title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
          text: "Telkom Indonesia memangkas jumlah anak usaha dari 67 menjadi 19 entitas menuju strategic holding.",
        }),
        candidate({
          dataSourceId: "ds-2",
          title: "Telkom Pangkas Anak Usaha Jadi 19 Entitas",
          text: "Telkom Indonesia memangkas anak usaha dari 67 menjadi 19 entitas dalam transformasi strategic holding.",
        }),
      ],
      memory.store,
    );

    expect(tally.storylinesOpened).toBe(1);
    expect(tally.citationsAdded).toBe(1);
    expect(memory.storylines[0]?.developments).toHaveLength(1);
    expect(memory.storylines[0]?.developments[0]?.citations).toEqual([
      "ds-1",
      "ds-2",
    ]);
  });

  it("skips an article that carries no distinctive anchors", async () => {
    const tally = await ingestCandidates(
      [candidate({ dataSourceId: "ds-1", title: "PT", text: "" })],
      memory.store,
    );

    expect(tally.skippedNoAnchors).toBe(1);
    expect(tally.storylinesOpened).toBe(0);
  });

  it("opens an unrelated article as its own storyline", async () => {
    const tally = await ingestCandidates(
      [
        candidate({
          dataSourceId: "ds-1",
          title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
          text: "Telkom Indonesia memangkas jumlah anak usaha menjadi 19 entitas menuju strategic holding.",
        }),
        candidate({
          dataSourceId: "ds-2",
          title: "Harga Pangan Hari Ini: Cabai Rawit Merah Turun",
          text: "Harga cabai rawit merah tercatat Rp61.900 per kilogram sementara telur ayam stabil.",
        }),
      ],
      memory.store,
    );

    expect(tally.storylinesOpened).toBe(2);
    expect(tally.citationsAdded).toBe(0);
  });

  it("locks a storyline once it spreads past the ticker ceiling", async () => {
    const seed = candidate({
      dataSourceId: "ds-1",
      title: "Telkom Pangkas Anak Usaha dari 67 Jadi 19",
      text: "Telkom Indonesia memangkas jumlah anak usaha dari 67 menjadi 19 entitas menuju strategic holding.",
    });
    const wide = candidate({
      dataSourceId: "ds-2",
      title: "Telkom Pangkas Anak Usaha Jadi 19 Entitas",
      text: "Telkom Indonesia memangkas anak usaha dari 67 menjadi 19 entitas dalam transformasi strategic holding.",
      tickerIds: ["t1", "t2", "t3", "t4", "t5", "t6"],
    });
    const tally = await ingestCandidates([seed, wide], memory.store);

    expect(tally.storylinesLocked).toBe(1);
    expect(memory.storylines[0]?.locked).toBe(true);
    expect(memory.storylines[0]?.lockedReason).toContain("tickers");
  });
});
