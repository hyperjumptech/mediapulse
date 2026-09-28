export const ExecutionInvocationCounts = ({
  succeededInvocationCount,
  failedInvocationCount,
}: {
  succeededInvocationCount: number;
  failedInvocationCount: number;
}) => {
  const hasFailures = failedInvocationCount > 0;
  const description = `${succeededInvocationCount} succeeded, ${failedInvocationCount} failed`;
  const failedCountClassName = hasFailures
    ? "font-medium text-destructive"
    : "text-muted-foreground";

  return (
    <span className="tabular-nums" title={description}>
      {succeededInvocationCount}
      <span className="text-muted-foreground"> / </span>
      <span data-failed={hasFailures} className={failedCountClassName}>
        {failedInvocationCount}
      </span>
    </span>
  );
};
