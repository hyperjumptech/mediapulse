import {
  formatObservedWindow,
  kindLabel,
  lockedLabel,
  lockedVariant,
  type StorylineEvidenceVariant,
} from "./storyline-labels";

export type StorylineHeaderPayload = {
  kindLabel: string;
  developmentsLabel: string;
  citationsLabel: string;
  lockedLabel: string;
  lockedVariant: StorylineEvidenceVariant;
  windowLabel: string;
  tickersLabel: string;
};

export type BuildStorylineHeaderInput = {
  kind: string;
  locked: boolean;
  firstObservedAt: Date;
  lastObservedAt: Date;
  developmentCount: number;
  citationCount: number;
  tickerSymbols: string[];
};

export function buildStorylineHeader(
  input: BuildStorylineHeaderInput,
): StorylineHeaderPayload {
  return {
    kindLabel: kindLabel(input.kind),
    developmentsLabel: String(input.developmentCount),
    citationsLabel: String(input.citationCount),
    lockedLabel: lockedLabel(input.locked),
    lockedVariant: lockedVariant(input.locked),
    windowLabel: formatObservedWindow(
      input.firstObservedAt,
      input.lastObservedAt,
    ),
    tickersLabel:
      input.tickerSymbols.length === 0 ? "—" : input.tickerSymbols.join(", "),
  };
}
