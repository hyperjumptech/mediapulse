import type { SearchQueriesPageResult } from "@/lib/search-queries";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { SearchQueryRowActions } from "./search-query-row-actions";

type SearchQueryRow = SearchQueriesPageResult["searchQueries"][number];

/**
 * Renders search queries as a table with keywords, ticker name, and delete row action.
 */
export const SearchQueriesTable = ({
  searchQueries,
}: {
  searchQueries: SearchQueryRow[];
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead>Keywords</TableHead>
            <TableHead>Ticker name</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {searchQueries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground"
              >
                No search queries found.
              </TableCell>
            </TableRow>
          ) : (
            searchQueries.map((searchQuery) => (
              <TableRow key={searchQuery.id}>
                <TableCell className="font-medium">
                  {searchQuery.text}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {searchQuery.ticker.name}
                </TableCell>
                <TableCell className="text-right">
                  <SearchQueryRowActions
                    searchQueryId={searchQuery.id}
                    keywords={searchQuery.text}
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
