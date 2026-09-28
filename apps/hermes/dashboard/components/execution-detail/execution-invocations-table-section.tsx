import type { ComponentProps } from "react";

import { ScheduleExecutionInvocationsTable } from "@/components/schedule-execution-invocations-table";
import {
  INVOCATIONS_DEFAULT_COLUMN_VISIBILITY,
  INVOCATIONS_TABLE_ID,
} from "@/components/schedule-execution-invocations-table-defaults";
import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";

type ExecutionInvocationsTableSectionProps = Omit<
  ComponentProps<typeof ScheduleExecutionInvocationsTable>,
  "initialColumnVisibility"
>;

export const ExecutionInvocationsTableSection = async (
  props: ExecutionInvocationsTableSectionProps,
) => {
  const savedVisibility = await readColumnVisibility(INVOCATIONS_TABLE_ID);

  return (
    <ScheduleExecutionInvocationsTable
      {...props}
      initialColumnVisibility={mergeColumnVisibility(
        INVOCATIONS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
