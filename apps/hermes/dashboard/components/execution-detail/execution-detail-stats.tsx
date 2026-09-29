import { DateTime } from "@/components/date-time/date-time";
import { StatTile, StatTileGrid } from "@/components/stat-card";

import type { ExecutionDetailViewModel } from "./execution-detail-view-model";

const countFormatter = new Intl.NumberFormat("en-US");

const failedValueClassName = (failedInvocationCount: number) =>
  failedInvocationCount > 0
    ? "text-destructive dark:text-red-400"
    : "text-muted-foreground";

const expectedCaption = (expectedInvocationCount: number) =>
  expectedInvocationCount > 0
    ? `of ${countFormatter.format(expectedInvocationCount)} expected`
    : undefined;

export const ExecutionDetailStats = ({
  viewModel,
}: {
  viewModel: ExecutionDetailViewModel;
}) => {
  const {
    executionTimeIso,
    elapsedLabel,
    succeededInvocationCount,
    failedInvocationCount,
    expectedInvocationCount,
  } = viewModel;

  return (
    <StatTileGrid>
      <StatTile
        label="Started"
        value={<DateTime value={executionTimeIso} style="compact" />}
      />
      <StatTile label="Duration" value={elapsedLabel} />
      <StatTile
        label="Succeeded"
        value={countFormatter.format(succeededInvocationCount)}
        caption={expectedCaption(expectedInvocationCount)}
      />
      <StatTile
        label="Failed"
        value={countFormatter.format(failedInvocationCount)}
        valueClassName={failedValueClassName(failedInvocationCount)}
      />
    </StatTileGrid>
  );
};
