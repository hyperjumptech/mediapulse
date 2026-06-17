import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";

import { fetchProcessedUrlsForExecution } from "@/lib/domain-dashboard";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 50;

const STATUS_BADGE: Record<string, "success" | "destructive" | "outline"> = {
  collected: "success",
  failed: "destructive",
  dropped: "outline",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Processed-URLs sub-page for a schedule execution: shows every URL processed
 * by data-collection and page-collection agents, with status and drop reason.
 */
export default async function ProcessedUrlsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: scheduleId, executionId } = await params;
  const resolvedSearchParams = await searchParams;

  const page = Math.max(
    1,
    Number.parseInt(first(resolvedSearchParams.page) ?? "1", 10) || 1,
  );
  const tickerId = first(resolvedSearchParams.tickerId);
  const agent = first(resolvedSearchParams.agent);
  const status = first(resolvedSearchParams.status);
  const gateStatus = first(resolvedSearchParams.gateStatus);

  let data: Awaited<ReturnType<typeof fetchProcessedUrlsForExecution>> | null =
    null;
  let fetchError: string | null = null;

  try {
    data = await fetchProcessedUrlsForExecution({
      scheduleExecutionId: executionId,
      page,
      pageSize: PAGE_SIZE,
      tickerId,
      agent,
      status,
      gateStatus,
    });
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : "Failed to load processed URLs";
  }

  const backHref = `/dashboard/schedules/${scheduleId}/executions/${executionId}`;

  const buildFilterHref = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      tickerId,
      agent,
      status,
      gateStatus,
      page: "1",
      ...updates,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();

    return qs
      ? `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls?${qs}`
      : `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls`;
  };

  const buildPageHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (tickerId) next.set("tickerId", tickerId);
    if (agent) next.set("agent", agent);
    if (status) next.set("status", status);
    if (gateStatus) next.set("gateStatus", gateStatus);
    next.set("page", String(targetPage));

    return `/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls?${next.toString()}`;
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to execution
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Processed URLs
        </h1>
        <p className="text-muted-foreground text-sm">
          Every URL seen by data-collection and page-collection agents in this
          execution.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground">Agent:</span>
        {["", "data-collection", "page-collection"].map((value) => (
          <Link
            key={value || "all"}
            href={buildFilterHref({ agent: value || undefined })}
            className={`rounded px-2 py-0.5 ${
              (agent ?? "") === value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {value || "All"}
          </Link>
        ))}
        <span className="ml-4 text-muted-foreground">Status:</span>
        {["", "collected", "dropped", "failed"].map((value) => (
          <Link
            key={value || "all"}
            href={buildFilterHref({ status: value || undefined })}
            className={`rounded px-2 py-0.5 ${
              (status ?? "") === value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {value || "All"}
          </Link>
        ))}
        <span className="ml-4 text-muted-foreground">Gate:</span>
        {["", "passed", "failed"].map((value) => (
          <Link
            key={value || "all-gate"}
            href={buildFilterHref({ gateStatus: value || undefined })}
            className={`rounded px-2 py-0.5 ${
              (gateStatus ?? "") === value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {value || "All"}
          </Link>
        ))}
      </div>

      {fetchError ? (
        <p className="text-sm text-destructive">{fetchError}</p>
      ) : data && data.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No processed URL outcomes for this execution. Outcomes are recorded
          from agent runs triggered after this feature was deployed.
        </p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.tickerSymbol}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.agent}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[item.status] ?? "outline"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {item.reasonDetail ?? item.reason ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-sm break-all text-xs">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {item.url.length > 80
                          ? `${item.url.slice(0, 80)}…`
                          : item.url}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-xs break-all text-xs text-muted-foreground">
                      {item.source ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {data.total} total · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageHref(page - 1)}
                    className="rounded border px-3 py-1 hover:bg-muted"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildPageHref(page + 1)}
                    className="rounded border px-3 py-1 hover:bg-muted"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
