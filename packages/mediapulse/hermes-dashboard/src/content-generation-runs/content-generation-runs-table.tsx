"use client";

import Link from "next/link";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import type { ContentGenerationRunListItem } from "@workspace/agent-data-api-contract";

import { AgentRunOutcomeBadge } from "../components/agent-run-outcome-badge";
import { CGA_DIAGNOSTICS_PATH_SEGMENT } from "../diagnostics-nav";
import { formatCompactDuration } from "../lib/format-duration";

type ContentGenerationRunsTableProps = {
  /** List of run records to display. */
  runs: ContentGenerationRunListItem[];
  /** Domain integration id for detail links. */
  integrationId: string;
};

/**
 * Formats a duration in milliseconds or returns "—" for null/undefined.
 *
 * @param durationMs - Duration in milliseconds.
 * @returns Compact human-readable string like "1.2s" or "—".
 */
const formatDuration = (durationMs: number | null | undefined): string => {
  if (durationMs == null) return "—";

  return formatCompactDuration(durationMs);
};

/**
 * Renders a table of content-generation runs with columns:
 * Created at, Ticker ID, Outcome, Stage, Error code, Duration.
 * Each row links to the detail page.
 *
 * @param props - Component props.
 * @param props.runs - Array of run records to display.
 * @returns Table element with rows for each run, or empty state message.
 */
export const ContentGenerationRunsTable = ({
  runs,
  integrationId,
}: ContentGenerationRunsTableProps) => {
  const basePath = `/dashboard/${integrationId}/${CGA_DIAGNOSTICS_PATH_SEGMENT}`;
  if (runs.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead>Created at</TableHead>
              <TableHead>Ticker ID</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Error code</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No content-generation runs found matching the current filters.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead>Created at</TableHead>
            <TableHead>Ticker ID</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Error code</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="text-muted-foreground text-sm">
                <Link
                  href={`${basePath}/${run.id}`}
                  className="underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground hover:text-foreground"
                >
                  {format(new Date(run.createdAt), "LLL d, yyyy HH:mm")}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {run.tickerId.slice(0, 8)}…
              </TableCell>
              <TableCell>
                <AgentRunOutcomeBadge outcome={run.outcome} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {run.stage ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {run.errorCode ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDuration(run.durationMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
