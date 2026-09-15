import {
  evidenceLabel,
  formatObservedWindow,
  kindLabel,
  tickerSourceLabel,
  truncateTitle,
} from "./storyline-labels";

export const STORYLINE_GRAPH_DEVELOPMENT_CAP = 40;
export const STORYLINE_GRAPH_CITATIONS_PER_DEVELOPMENT = 4;
export const STORYLINE_GRAPH_TOTAL_SOURCE_CAP = 100;

export const STORYLINE_GRAPH_RANK_TICKER = 0;
export const STORYLINE_GRAPH_RANK_STORYLINE = 1;
export const STORYLINE_GRAPH_RANK_DEVELOPMENT = 2;
export const STORYLINE_GRAPH_RANK_SOURCE = 3;

export type StorylineGraphNode = {
  id: string;
  label: string;
  group: string;
  tooltip: string | null;
  rank: number;
  order: number;
  emphasis: boolean;
  linkResource: string | null;
  linkId: string | null;
};

export type StorylineGraphEdge = {
  source: string;
  target: string;
  label: string | null;
};

export type StorylineGraphPayload = {
  nodes: StorylineGraphNode[];
  edges: StorylineGraphEdge[];
  truncated: boolean;
  truncatedLabel: string;
};

export type BuildStorylineGraphInput = {
  storyline: {
    id: string;
    name: string;
    kind: string;
    firstObservedAt: Date;
    lastObservedAt: Date;
  };
  tickers: {
    tickerId: string;
    symbol: string;
    name: string;
    source: string;
  }[];
  developments: {
    id: string;
    title: string;
    observedAt: Date;
    attachEvidence: unknown;
    citationCount: number;
  }[];
  citations: {
    developmentId: string;
    dataSourceId: string;
    title: string | null;
    url: string;
    publisher: string | null;
  }[];
};

const isoDay = (value: Date): string => value.toISOString().slice(0, 10);

export function buildStorylineGraph(
  input: BuildStorylineGraphInput,
): StorylineGraphPayload {
  const nodes: StorylineGraphNode[] = [];
  const edges: StorylineGraphEdge[] = [];
  const notes: string[] = [];

  const storylineNodeId = `storyline:${input.storyline.id}`;
  const totalCitations = input.developments.reduce(
    (sum, development) => sum + development.citationCount,
    0,
  );

  nodes.push({
    id: storylineNodeId,
    label: truncateTitle(input.storyline.name),
    group: "storyline",
    tooltip: [
      kindLabel(input.storyline.kind),
      `${String(input.developments.length)} developments`,
      `${String(totalCitations)} citations`,
      formatObservedWindow(
        input.storyline.firstObservedAt,
        input.storyline.lastObservedAt,
      ),
    ].join(" · "),
    rank: STORYLINE_GRAPH_RANK_STORYLINE,
    order: 0,
    emphasis: true,
    linkResource: null,
    linkId: null,
  });

  const sortedTickers = [...input.tickers].sort((first, second) =>
    first.symbol.localeCompare(second.symbol),
  );
  sortedTickers.forEach((ticker, index) => {
    const tickerNodeId = `ticker:${ticker.tickerId}`;
    nodes.push({
      id: tickerNodeId,
      label: ticker.symbol,
      group: "ticker",
      tooltip: `${ticker.name} — linked by ${tickerSourceLabel(ticker.source).toLowerCase()}`,
      rank: STORYLINE_GRAPH_RANK_TICKER,
      order: index,
      emphasis: false,
      linkResource: "tickers",
      linkId: ticker.tickerId,
    });
    edges.push({
      source: tickerNodeId,
      target: storylineNodeId,
      label: ticker.source === "operator" ? "operator" : null,
    });
  });

  const chronological = [...input.developments].sort(
    (first, second) => first.observedAt.getTime() - second.observedAt.getTime(),
  );
  const overflowDevelopmentCount = Math.max(
    0,
    chronological.length - STORYLINE_GRAPH_DEVELOPMENT_CAP,
  );
  const shownDevelopments = chronological.slice(
    -STORYLINE_GRAPH_DEVELOPMENT_CAP,
  );

  if (overflowDevelopmentCount > 0) {
    const overflowNodeId = "development:overflow";
    nodes.push({
      id: overflowNodeId,
      label: `+${String(overflowDevelopmentCount)} earlier developments`,
      group: "overflow",
      tooltip: null,
      rank: STORYLINE_GRAPH_RANK_DEVELOPMENT,
      order: -1,
      emphasis: false,
      linkResource: null,
      linkId: null,
    });
    edges.push({
      source: storylineNodeId,
      target: overflowNodeId,
      label: null,
    });
    notes.push(
      `${String(overflowDevelopmentCount)} earlier developments are not drawn.`,
    );
  }

  const citationsByDevelopment = new Map<
    string,
    BuildStorylineGraphInput["citations"]
  >();
  for (const citation of input.citations) {
    const bucket = citationsByDevelopment.get(citation.developmentId) ?? [];
    bucket.push(citation);
    citationsByDevelopment.set(citation.developmentId, bucket);
  }

  let sourceBudget = STORYLINE_GRAPH_TOTAL_SOURCE_CAP;
  let hiddenSources = 0;

  shownDevelopments.forEach((development, developmentIndex) => {
    const developmentNodeId = `development:${development.id}`;
    nodes.push({
      id: developmentNodeId,
      label: truncateTitle(development.title),
      group: "development",
      tooltip: `${isoDay(development.observedAt)} · ${evidenceLabel(development.attachEvidence)}`,
      rank: STORYLINE_GRAPH_RANK_DEVELOPMENT,
      order: developmentIndex,
      emphasis: false,
      linkResource: null,
      linkId: null,
    });
    edges.push({
      source: storylineNodeId,
      target: developmentNodeId,
      label: null,
    });

    const citations = citationsByDevelopment.get(development.id) ?? [];
    const perDevelopmentLimit = Math.min(
      STORYLINE_GRAPH_CITATIONS_PER_DEVELOPMENT,
      Math.max(0, sourceBudget),
    );
    const shownCitations = citations.slice(0, perDevelopmentLimit);
    sourceBudget -= shownCitations.length;

    shownCitations.forEach((citation, citationIndex) => {
      const sourceNodeId = `source:${citation.dataSourceId}`;
      nodes.push({
        id: sourceNodeId,
        label: truncateTitle(citation.title ?? citation.url),
        group: "source",
        tooltip: [citation.publisher, citation.url]
          .filter((part): part is string => part !== null && part !== "")
          .join(" · "),
        rank: STORYLINE_GRAPH_RANK_SOURCE,
        order: developmentIndex * 1000 + citationIndex,
        emphasis: false,
        linkResource: "data-sources",
        linkId: citation.dataSourceId,
      });
      edges.push({
        source: developmentNodeId,
        target: sourceNodeId,
        label: null,
      });
    });

    const hiddenForDevelopment = citations.length - shownCitations.length;
    if (hiddenForDevelopment > 0) {
      hiddenSources += hiddenForDevelopment;
      const overflowNodeId = `source:overflow:${development.id}`;
      nodes.push({
        id: overflowNodeId,
        label: `+${String(hiddenForDevelopment)} more sources`,
        group: "overflow",
        tooltip: null,
        rank: STORYLINE_GRAPH_RANK_SOURCE,
        order:
          developmentIndex * 1000 + STORYLINE_GRAPH_CITATIONS_PER_DEVELOPMENT,
        emphasis: false,
        linkResource: null,
        linkId: null,
      });
      edges.push({
        source: developmentNodeId,
        target: overflowNodeId,
        label: null,
      });
    }
  });

  if (hiddenSources > 0) {
    notes.push(`${String(hiddenSources)} further sources are not drawn.`);
  }

  return {
    nodes,
    edges,
    truncated: notes.length > 0,
    truncatedLabel: notes.join(" "),
  };
}
