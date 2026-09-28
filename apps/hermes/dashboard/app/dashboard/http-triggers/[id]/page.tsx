import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionSkeleton } from "@/components/page-skeletons";
import {
  getHttpTriggerById,
  getHttpTriggerExecutionsPage,
} from "@/lib/http-triggers";
import {
  parseListPagination,
  type ListPageSearchParams,
} from "@/lib/list-page-params";
import { getPipelinesWithSteps } from "@/lib/pipelines";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { HttpTriggerDetailContent } from "./http-trigger-detail-content";
import { HttpTriggerExecutionsSection } from "./http-trigger-executions-section";

type HttpTriggerDetailSearchParams = Pick<
  ListPageSearchParams,
  "page" | "size"
>;

const HttpTriggerDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams:
    | Promise<HttpTriggerDetailSearchParams>
    | HttpTriggerDetailSearchParams;
}) => {
  const { id } = await params;
  const resolved = await Promise.resolve(searchParams);
  const { page, pageSize } = parseListPagination(resolved);
  const executionsPage = getHttpTriggerExecutionsPage(id, page, pageSize);
  void executionsPage.catch(() => undefined);
  const [trigger, pipelines] = await withDashboardAdmin(
    Promise.all([getHttpTriggerById(id), getPipelinesWithSteps()]),
  );

  if (!trigger) {
    notFound();
  }

  return (
    <HttpTriggerDetailContent
      trigger={trigger}
      executionsSection={
        <Suspense key={`${page}:${pageSize}`} fallback={<SectionSkeleton />}>
          <HttpTriggerExecutionsSection
            triggerId={trigger.id}
            page={page}
            pageSize={pageSize}
            executionsPage={executionsPage}
          />
        </Suspense>
      }
      pipelines={pipelines}
    />
  );
};

export default HttpTriggerDetailPage;
