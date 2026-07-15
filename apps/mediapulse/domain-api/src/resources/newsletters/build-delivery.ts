import type { Prisma, prisma } from "@mediapulse/database";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Agent id shown in the stage's Agent KPI card (a single agent produces this stage). */
const DELIVERY_AGENT_ID = "delivery" as const;

/** Badge variant for the delivery outcome KPI, banded green / amber / red / muted. */
export type DeliveryOutcomeVariant =
  | "success"
  | "warning"
  | "destructive"
  | "muted";

/** Shape of the delivery-stage payload exposed by the detail handler. */
export type DeliveryPayload = {
  agentLabel: string;
  deliveredAtLabel: string;
  outcomeLabel: string;
  outcomeVariant: DeliveryOutcomeVariant;
  deliveredLabel: string;
};

/** Prisma collaborator surface for {@link buildDelivery}. */
export type BuildDeliveryDeps = {
  deliveryRun: Pick<typeof prisma.deliveryRun, "findFirst">;
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "Success",
  partial_success: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  skipped_all_already_delivered: "Already delivered",
};

const OUTCOME_VARIANT: Record<string, DeliveryOutcomeVariant> = {
  success: "success",
  partial_success: "warning",
  failed: "destructive",
  skipped: "muted",
  skipped_all_already_delivered: "muted",
};

const formatDeliveredAt = (date: Date): string => {
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: STAGE_TIMEZONE,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STAGE_TIMEZONE,
  }).format(date);

  return `${datePart} at ${timePart}`;
};

/**
 * Assembles the delivery-stage KPI payload for a newsletter from the exact `DeliveryRun` that sent it:
 * the delivery agent and version, when it ran, its outcome, and how many recipients were delivered.
 * The delivered/total counts are passed in from the recipients aggregate so retries are reflected.
 *
 * @param newsletterId - Newsletter whose delivery to summarize.
 * @param counts - Aggregated recipient counts (delivered of total) from the recipients builder.
 * @param deps - Prisma `deliveryRun` delegate.
 * @returns The delivery KPI payload.
 */
export const buildDelivery = async (
  newsletterId: string,
  counts: { delivered: number; total: number },
  deps: BuildDeliveryDeps,
): Promise<DeliveryPayload> => {
  const run = await deps.deliveryRun.findFirst({
    where: { newsletterId },
    orderBy: { createdAt: "desc" },
    select: {
      agentId: true,
      agentVersion: true,
      outcome: true,
      createdAt: true,
    },
  } satisfies Prisma.DeliveryRunFindFirstArgs);

  const agentLabel = run
    ? `${run.agentId} - ${run.agentVersion}`
    : DELIVERY_AGENT_ID;

  return {
    agentLabel,
    deliveredAtLabel: run ? formatDeliveredAt(run.createdAt) : "—",
    outcomeLabel: run ? (OUTCOME_LABEL[run.outcome] ?? run.outcome) : "—",
    outcomeVariant: run ? (OUTCOME_VARIANT[run.outcome] ?? "muted") : "muted",
    deliveredLabel: `${counts.delivered.toLocaleString("en-US")} / ${counts.total.toLocaleString("en-US")}`,
  };
};
