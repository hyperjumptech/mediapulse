import { z } from "zod";

export const STORYLINE_TITLE_MAX_CHARS = 80;

export type StorylineEvidenceVariant =
  | "success"
  | "warning"
  | "muted"
  | "outline";

const attachEvidenceSchema = z.object({
  sharedAnchors: z.number(),
  containment: z.number(),
  storylineContainment: z.number(),
  path: z.enum(["body", "title"]),
});

export type StorylineAttachEvidence = z.infer<typeof attachEvidenceSchema>;

export const kindLabel = (kind: string): string =>
  kind === "format" ? "Format" : "Story";

export const lockedLabel = (locked: boolean): string =>
  locked ? "Locked" : "Open";

export const lockedVariant = (locked: boolean): StorylineEvidenceVariant =>
  locked ? "warning" : "success";

export const tickerSourceLabel = (source: string): string =>
  source === "operator" ? "Operator" : "Placement";

export const truncateTitle = (
  value: string,
  maxChars: number = STORYLINE_TITLE_MAX_CHARS,
): string => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

export const parseAttachEvidence = (
  value: unknown,
): StorylineAttachEvidence | null => {
  const parsed = attachEvidenceSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
};

export const evidenceLabel = (value: unknown): string => {
  const evidence = parseAttachEvidence(value);
  if (!evidence) {
    return "Opened this storyline";
  }

  const pathLabel = evidence.path === "body" ? "Body path" : "Title path";
  const anchorNoun = evidence.sharedAnchors === 1 ? "anchor" : "anchors";

  return [
    pathLabel,
    `${String(evidence.sharedAnchors)} shared ${anchorNoun}`,
    `containment ${evidence.containment.toFixed(2)}`,
    `thread ${evidence.storylineContainment.toFixed(2)}`,
  ].join(" · ");
};

export const evidenceVariant = (value: unknown): StorylineEvidenceVariant => {
  const evidence = parseAttachEvidence(value);
  if (!evidence) {
    return "outline";
  }
  if (evidence.containment >= 0.6) {
    return "success";
  }
  if (evidence.containment >= 0.4) {
    return "warning";
  }

  return "muted";
};

export const formatObservedWindow = (
  firstObservedAt: Date,
  lastObservedAt: Date,
): string => {
  const format = (value: Date): string => value.toISOString().slice(0, 10);
  const first = format(firstObservedAt);
  const last = format(lastObservedAt);

  return first === last ? first : `${first} – ${last}`;
};
