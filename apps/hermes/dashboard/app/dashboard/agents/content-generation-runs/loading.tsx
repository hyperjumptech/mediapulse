import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

/**
 * Loading skeleton for the content-generation runs list page.
 * Rendered by Next.js while the server component streams data.
 */
export default function ContentGenerationRunsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-96 animate-pulse rounded-md bg-muted" />
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
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
