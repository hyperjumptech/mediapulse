import { notFound, redirect } from "next/navigation";
import { prisma } from "@hermes/orchestration-database";

import { withDashboardAdmin } from "@/lib/require-dashboard-admin";
import { resolveExecutionHref } from "@/lib/resolve-execution-href";

type PageProps = {
  params: Promise<{ executionId: string }>;
};

export default async function ExecutionRedirectPage({ params }: PageProps) {
  const { executionId } = await params;
  const href = await withDashboardAdmin(
    resolveExecutionHref(executionId, prisma),
  );
  if (href === null) {
    notFound();
  }

  redirect(href);
}
