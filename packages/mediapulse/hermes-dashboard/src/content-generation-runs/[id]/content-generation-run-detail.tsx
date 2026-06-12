"use client";

import Link from "next/link";
import { format } from "date-fns";

import { AgentRunOutcomeBadge } from "../../components/agent-run-outcome-badge";
import type { ContentGenerationRunListItem } from "@workspace/agent-data-api-contract";
import { useCopyToClipboard } from "../../hooks/use-copy-to-clipboard";
import { formatCompactDuration } from "../../lib/format-duration";

type ContentGenerationRunDetailProps = {
  /** The run record to display. */
  run: ContentGenerationRunListItem;
};

const BASE_PATH = "/dashboard/agents/content-generation-runs";

/**
 * Renders a definition-list layout of all fields for a content-generation run.
 * Includes a back link and a copy-to-clipboard button for newsletterId when present.
 *
 * @param props - Component props.
 * @param props.run - The run data to display.
 * @returns Detail view with all fields rendered.
 */
export const ContentGenerationRunDetail = ({
  run,
}: ContentGenerationRunDetailProps) => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={BASE_PATH}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to content-generation runs
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Run details</h2>
        <AgentRunOutcomeBadge outcome={run.outcome} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono">{run.id}</dd>

        <dt className="text-muted-foreground">Agent ID</dt>
        <dd>{run.agentId}</dd>

        <dt className="text-muted-foreground">Agent version</dt>
        <dd>{run.agentVersion}</dd>

        <dt className="text-muted-foreground">Ticker ID</dt>
        <dd className="font-mono">{run.tickerId}</dd>

        <dt className="text-muted-foreground">Stage</dt>
        <dd>{run.stage ?? "—"}</dd>

        <dt className="text-muted-foreground">Error code</dt>
        <dd>{run.errorCode ?? "—"}</dd>

        <dt className="text-muted-foreground">Error category</dt>
        <dd>{run.errorCategory ?? "—"}</dd>

        <dt className="text-muted-foreground">Message</dt>
        <dd>
          {run.message ? (
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {run.message}
            </pre>
          ) : (
            "—"
          )}
        </dd>

        <dt className="text-muted-foreground">Duration</dt>
        <dd>
          {run.durationMs != null ? formatCompactDuration(run.durationMs) : "—"}
        </dd>

        <dt className="text-muted-foreground">Pipeline run ID</dt>
        <dd>{run.pipelineRunId ?? "—"}</dd>

        <dt className="text-muted-foreground">Execution ID</dt>
        <dd>{run.executionId ?? "—"}</dd>

        <dt className="text-muted-foreground">Newsletter ID</dt>
        <dd>
          {run.newsletterId ? (
            <button
              type="button"
              onClick={() => copy(run.newsletterId!)}
              className="inline-flex items-center gap-2 font-mono text-primary underline underline-offset-2 hover:text-foreground"
            >
              {run.newsletterId}
              <span className="text-xs text-muted-foreground">
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>
          ) : (
            "—"
          )}
        </dd>

        <dt className="text-muted-foreground">Created at</dt>
        <dd>{format(new Date(run.createdAt), "LLL d, yyyy HH:mm:ss")}</dd>
      </dl>
    </div>
  );
};
