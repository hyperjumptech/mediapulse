import { Context } from "hono";

import {
  deliveryRunQuerySchema,
  getDeliveryRunResponseSchema,
  postDeliveryRunBodySchema,
  postDeliveryRunResponseSchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import {
  createDeliveryRun,
  listDeliveryRuns,
} from "../services/delivery-run.js";

export async function getDeliveryRun(context: Context): Promise<Response> {
  try {
    const rawQuery = context.req.query();
    const normalizedQuery = Object.fromEntries(
      Object.entries(rawQuery).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    const query = deliveryRunQuerySchema.parse(normalizedQuery);
    const rows = await listDeliveryRuns({
      ...(query.tickerId !== undefined ? { tickerId: query.tickerId } : {}),
      ...(query.outcome !== undefined ? { outcome: query.outcome } : {}),
      ...(query.start !== undefined ? { start: new Date(query.start) } : {}),
      ...(query.end !== undefined ? { end: new Date(query.end) } : {}),
    });

    const data = rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      agentVersion: row.agentVersion,
      tickerId: row.tickerId,
      tickerSymbol: row.ticker.symbol,
      newsletterId: row.newsletterId,
      outcome: row.outcome,
      stage: row.stage,
      successCount: row.successCount,
      failureCount: row.failureCount,
      skippedCount: row.skippedCount,
      durationMs: row.durationMs,
      scheduleExecutionId: row.scheduleExecutionId,
      hermesScheduleId: row.hermesScheduleId,
      pipelineStepId: row.pipelineStepId,
      jobId: row.jobId,
      hermesExecutionId: row.hermesExecutionId,
      runSkipReason: row.runSkipReason,
      recipientErrorSummary: row.recipientErrorSummary,
      createdAt: row.createdAt.toISOString(),
    }));

    const response = getDeliveryRunResponseSchema.parse({ data });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDeliveryRun(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDeliveryRunBodySchema.parseAsync(body);

    await createDeliveryRun({
      id: data.id,
      agentId: data.agentId,
      agentVersion: data.agentVersion,
      tickerId: data.tickerId,
      newsletterId: data.newsletterId,
      outcome: data.outcome,
      stage: data.stage ?? undefined,
      successCount: data.successCount,
      failureCount: data.failureCount,
      skippedCount: data.skippedCount,
      durationMs: data.durationMs,
      scheduleExecutionId: data.scheduleExecutionId,
      hermesScheduleId: data.hermesScheduleId,
      pipelineStepId: data.pipelineStepId,
      jobId: data.jobId,
      hermesExecutionId: data.hermesExecutionId,
      runSkipReason: data.runSkipReason,
      resendMessageIds: data.resendMessageIds,
      recipientErrorSummary: data.recipientErrorSummary,
      recipients: data.recipients.map((r) => ({
        userTickerId: r.userTickerId,
        status: r.status,
        attempts: r.attempts,
        lastErrorCode: r.lastErrorCode ?? null,
        lastErrorMessage: r.lastErrorMessage ?? null,
        errorCategory: r.errorCategory ?? null,
        resendEmailId: r.resendEmailId ?? null,
      })),
    });

    const response = postDeliveryRunResponseSchema.parse({
      message: "Success",
    });
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
