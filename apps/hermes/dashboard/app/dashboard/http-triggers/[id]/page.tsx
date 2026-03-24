import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import {
  getHttpTriggerById,
  getHttpTriggerExecutionsPage,
} from "@/lib/http-triggers";
import { HttpTriggerDetailContent } from "./http-trigger-detail-content";

const DEFAULT_PAGE_SIZE = 15;

/**
 * HTTP trigger detail page with execution history.
 */
const HttpTriggerDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<{ page?: string; size?: string }>
    | { page?: string; size?: string };
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.size ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );

  const [trigger, executionsResult, pipelines] = await Promise.all([
    getHttpTriggerById(id),
    getHttpTriggerExecutionsPage(id, page, pageSize),
    getPipelinesWithSteps(),
  ]);
  if (!trigger) notFound();

  return (
    <HttpTriggerDetailContent
      trigger={trigger}
      executions={executionsResult.executions}
      totalExecutions={executionsResult.total}
      currentPage={executionsResult.page}
      pageSize={executionsResult.pageSize}
      pipelines={pipelines}
    />
  );
};

export default withAuthProtection(HttpTriggerDetailPage);
