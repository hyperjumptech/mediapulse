import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import {
  getPipelineStatus,
  type PipelineValidationResult,
} from "@/lib/pipeline-status";

import { PipelineRowActions } from "./pipeline-row-actions";
import { PipelineStatusBadge } from "./pipeline-status-badge";

type PipelineWithSteps = Awaited<
  ReturnType<typeof import("@/lib/pipelines").getPipelinesWithSteps>
>[number];

/**
 * Renders the pipelines list as a table with Name, Description, Status (Incomplete/Disabled/Enabled), and row actions.
 * When onEdit is provided, Edit opens the modal; otherwise Edit links to the pipeline detail page.
 */
export const PipelinesTable = ({
  pipelines,
  pipelineValidationById = {},
  onEdit,
}: {
  pipelines: PipelineWithSteps[];
  pipelineValidationById?: Record<string, PipelineValidationResult>;
  onEdit?: (pipelineId: string) => void;
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pipelines.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No pipelines yet. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            pipelines.map((pipeline) => {
              const status = getPipelineStatus(
                pipeline,
                pipelineValidationById[pipeline.id] ?? {
                  valid: false,
                  warnings: [],
                },
              );
              return (
                <TableRow key={pipeline.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/pipelines/${pipeline.id}`}
                      className="hover:underline"
                    >
                      {pipeline.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pipeline.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PipelineStatusBadge status={status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <PipelineRowActions
                      pipelineId={pipeline.id}
                      pipelineName={pipeline.name}
                      onEdit={onEdit}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
