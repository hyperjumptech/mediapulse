import {
  anchorsFor,
  decideAttachment,
  lockReasonFor,
  type AttachEvidence,
  type Candidate,
  type StorylineSnapshot,
} from "./attach.js";

export type IngestCandidate = Candidate & {
  observedAt: Date;
  tickerIds: readonly string[];
};

export type OpenStorylineCommand = {
  name: string;
  observedAt: Date;
  anchors: readonly string[];
  titleAnchors: readonly string[];
  title: string;
  dataSourceId: string;
  tickerIds: readonly string[];
};

export type OpenDevelopmentCommand = {
  storylineId: string;
  title: string;
  observedAt: Date;
  anchors: readonly string[];
  titleAnchors: readonly string[];
  dataSourceId: string;
  tickerIds: readonly string[];
  evidence: AttachEvidence;
};

export type CiteCommand = {
  developmentId: string;
  storylineId: string;
  dataSourceId: string;
  tickerIds: readonly string[];
  observedAt: Date;
};

/**
 * Everything ingestion needs from storage. Kept as a port so the decision loop is exercised without
 * a database, and so the reader can retrieve by anchor rather than by scanning every Storyline.
 */
export type KnowledgeStore = {
  findStorylinesByAnchors: (
    anchors: readonly string[],
  ) => Promise<StorylineSnapshot[]>;
  openStoryline: (command: OpenStorylineCommand) => Promise<string>;
  openDevelopment: (command: OpenDevelopmentCommand) => Promise<string>;
  cite: (command: CiteCommand) => Promise<void>;
  tickerCountFor: (storylineId: string) => Promise<number>;
  developmentCountFor: (storylineId: string) => Promise<number>;
  lockStoryline: (storylineId: string, reason: string) => Promise<void>;
};

export type IngestTally = {
  considered: number;
  storylinesOpened: number;
  developmentsOpened: number;
  citationsAdded: number;
  storylinesLocked: number;
  skippedNoAnchors: number;
};

const emptyTally = (): IngestTally => ({
  considered: 0,
  storylinesOpened: 0,
  developmentsOpened: 0,
  citationsAdded: 0,
  storylinesLocked: 0,
  skippedNoAnchors: 0,
});

/**
 * Locks a Storyline that has grown past either ceiling, so it stops accepting further attachment.
 */
const enforceCeiling = async (
  store: KnowledgeStore,
  storylineId: string,
  tally: IngestTally,
): Promise<void> => {
  const tickerCount = await store.tickerCountFor(storylineId);
  const developmentCount = await store.developmentCountFor(storylineId);
  const reason = lockReasonFor(tickerCount, developmentCount);
  if (reason === null) {
    return;
  }
  await store.lockStoryline(storylineId, reason);
  tally.storylinesLocked += 1;
};

/**
 * Runs every candidate article through the attach decision and applies it.
 *
 * - Important: candidates must be supplied oldest first. A Storyline's history is append-only, so
 *   ingesting out of order would attribute a move to the wrong point in the thread.
 *
 * @param candidates - Articles to consider, oldest first.
 * @param store - Storage port.
 * @returns Counters for the run chronicle.
 */
export const ingestCandidates = async (
  candidates: readonly IngestCandidate[],
  store: KnowledgeStore,
): Promise<IngestTally> => {
  const tally = emptyTally();

  for (const candidate of candidates) {
    tally.considered += 1;

    const anchors = anchorsFor(candidate);
    if (anchors.anchors.size === 0) {
      tally.skippedNoAnchors += 1;
      continue;
    }

    const anchorList = [...anchors.anchors];
    const titleAnchorList = [...anchors.titleAnchors];
    const storylines = await store.findStorylinesByAnchors(anchorList);
    const decision = decideAttachment(
      anchors,
      candidate.publishedDay,
      storylines,
    );

    if (decision.kind === "skip") {
      tally.skippedNoAnchors += 1;
      continue;
    }

    if (decision.kind === "openStoryline") {
      await store.openStoryline({
        name: candidate.title,
        observedAt: candidate.observedAt,
        anchors: anchorList,
        titleAnchors: titleAnchorList,
        title: candidate.title,
        dataSourceId: candidate.dataSourceId,
        tickerIds: candidate.tickerIds,
      });
      tally.storylinesOpened += 1;
      tally.developmentsOpened += 1;
      continue;
    }

    if (decision.kind === "openDevelopment") {
      await store.openDevelopment({
        storylineId: decision.storylineId,
        title: candidate.title,
        observedAt: candidate.observedAt,
        anchors: anchorList,
        titleAnchors: titleAnchorList,
        dataSourceId: candidate.dataSourceId,
        tickerIds: candidate.tickerIds,
        evidence: decision.evidence,
      });
      tally.developmentsOpened += 1;
      await enforceCeiling(store, decision.storylineId, tally);
      continue;
    }

    await store.cite({
      developmentId: decision.developmentId,
      storylineId: decision.storylineId,
      dataSourceId: candidate.dataSourceId,
      tickerIds: candidate.tickerIds,
      observedAt: candidate.observedAt,
    });
    tally.citationsAdded += 1;
    await enforceCeiling(store, decision.storylineId, tally);
  }

  return tally;
};
