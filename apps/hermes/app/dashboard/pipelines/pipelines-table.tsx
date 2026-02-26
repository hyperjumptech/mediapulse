import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { PipelineRowActions } from "./pipeline-row-actions";

type PipelineWithSteps = Awaited<
  ReturnType<typeof import("@/lib/pipelines").getPipelinesWithSteps>
>[number];

/**
 * Renders the pipelines list as a table with Name, Description, Status, and row actions dropdown.
 */
export const PipelinesTable = ({
  pipelines,
}: {
  pipelines: PipelineWithSteps[];
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
            pipelines.map((pipeline) => (
              <TableRow key={pipeline.id}>
                <TableCell className="font-medium">{pipeline.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {pipeline.description ?? "—"}
                </TableCell>
                <TableCell>
                  {pipeline.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <PipelineRowActions
                    pipelineId={pipeline.id}
                    pipelineName={pipeline.name}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
