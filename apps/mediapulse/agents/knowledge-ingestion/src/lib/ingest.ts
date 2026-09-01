import type { KnowledgeWriteResult } from "@workspace/agent-data-api-contract";

import {
  anchorsFor,
  decideAttachment,
  type AttachEvidence,
  type Candidate,
  type StorylineSnapshot,
} from "./attach.js";

export type IngestCandidate = Candidate & {
  observedAt: string;
  tickerIds: readonly string[];
};

export type OpenStorylineCommand = {
  name: string;
  title: string;
  observedAt: string;
  anchors: readonly string[];
  titleAnchors: readonly string[];
  figures: readonly string[];
  dataSourceId: string;
  tickerIds: readonly string[];
};

export type OpenDevelopmentCommand = OpenStorylineCommand & {
  storylineId: string;
  evidence: AttachEvidence;
};

export type CiteCommand = {
  storylineId: string;
  developmentId: string;
  dataSourceId: string;
  tickerIds: readonly string[];
  observedAt: string;
  anchors: readonly string[];
};

/**
 * Everything ingestion needs from storage.
 *
 * - Important: the ceiling is applied by the writer, not here. Every write reports whether it locked
 *   the Storyline, so the agent counts the outcome instead of deciding it and the two cannot drift.
 */
export type KnowledgeStore = {
  findStorylinesByAnchors: (
    anchors: readonly string[],
  ) => Promise<StorylineSnapshot[]>;
  openStoryline: (
    command: OpenStorylineCommand,
  ) => Promise<KnowledgeWriteResult>;
  openDevelopment: (
    command: OpenDevelopmentCommand,
  ) => Promise<KnowledgeWriteResult>;
  cite: (command: CiteCommand) => Promise<KnowledgeWriteResult>;
};

export type IngestTally = {
  considered: number;
  storylinesOpened: number;
  developmentsOpened: number;
  citationsAdded: number;
  storylinesLocked: number;
  skippedNoAnchors: number;
};

export type IngestFailure = {
  dataSourceId: string;
  message: string;
};

export type IngestOutcome = {
  tally: IngestTally;
  failures: IngestFailure[];
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
 * Runs every candidate article through the attach decision and applies it.
 *
 * - Important: candidates must be supplied oldest first. A Storyline's history is append-only, so
 *   ingesting out of order would attribute a move to the wrong point in the thread.
 *
 * - Important: a candidate that throws is recorded and skipped rather than ending the run, so one
 *   unusable row cannot stall the watermark for every row behind it.
 *
 * @param candidates - Articles to consider, oldest first.
 * @param store - Storage port.
 * @returns Counters for the run chronicle, plus every candidate that could not be ingested.
 */
export const ingestCandidates = async (
  candidates: readonly IngestCandidate[],
  store: KnowledgeStore,
): Promise<IngestOutcome> => {
  const tally = emptyTally();
  const failures: IngestFailure[] = [];
  const alreadyLocked = new Set<string>();

  const countLock = (result: KnowledgeWriteResult): void => {
    if (!result.locked || alreadyLocked.has(result.storylineId)) {
      return;
    }
    alreadyLocked.add(result.storylineId);
    tally.storylinesLocked += 1;
  };

  const ingestOne = async (candidate: IngestCandidate): Promise<void> => {
    const anchors = anchorsFor(candidate);
    if (anchors.anchors.size === 0) {
      tally.skippedNoAnchors += 1;

      return;
    }

    const anchorList = [...anchors.anchors];
    const titleAnchorList = [...anchors.titleAnchors];
    const figureList = [...anchors.figures];
    const storylines = await store.findStorylinesByAnchors(anchorList);
    const decision = decideAttachment(
      anchors,
      candidate.publishedDay,
      storylines,
    );

    if (decision.kind === "skip") {
      tally.skippedNoAnchors += 1;

      return;
    }

    const base = {
      name: candidate.title,
      title: candidate.title,
      observedAt: candidate.observedAt,
      anchors: anchorList,
      titleAnchors: titleAnchorList,
      figures: figureList,
      dataSourceId: candidate.dataSourceId,
      tickerIds: candidate.tickerIds,
    };

    if (decision.kind === "openStoryline") {
      countLock(await store.openStoryline(base));
      tally.storylinesOpened += 1;
      tally.developmentsOpened += 1;

      return;
    }

    if (decision.kind === "openDevelopment") {
      countLock(
        await store.openDevelopment({
          ...base,
          storylineId: decision.storylineId,
          evidence: decision.evidence,
        }),
      );
      tally.developmentsOpened += 1;

      return;
    }

    countLock(
      await store.cite({
        storylineId: decision.storylineId,
        developmentId: decision.developmentId,
        dataSourceId: candidate.dataSourceId,
        tickerIds: candidate.tickerIds,
        observedAt: candidate.observedAt,
        anchors: anchorList,
      }),
    );
    tally.citationsAdded += 1;
  };

  for (const candidate of candidates) {
    tally.considered += 1;

    try {
      await ingestOne(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ dataSourceId: candidate.dataSourceId, message });
    }
  }

  return { tally, failures };
};
