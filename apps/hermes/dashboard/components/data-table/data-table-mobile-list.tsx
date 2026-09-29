"use client";

import { FlexRender, type Row, type RowData } from "@tanstack/react-table";

import { cn } from "@workspace/ui/lib/utils";

import type { DataTableFeatures } from "@/lib/data-table/features";

type MobileCells<Data extends RowData> = ReturnType<
  Row<DataTableFeatures, Data>["getVisibleCells"]
>;

const cellsWithRole = <Data extends RowData>(
  cells: MobileCells<Data>,
  role: string,
): MobileCells<Data> =>
  cells.filter(
    (cell) => (cell.column.columnDef.meta?.mobile ?? "field") === role,
  );

const wrapsOnMobile = <Data extends RowData>(
  cell: MobileCells<Data>[number],
): boolean => cell.column.columnDef.meta?.mobileWrap === true;

const overflowClassName = (wraps: boolean) =>
  wraps ? "wrap-anywhere" : "truncate";

const MobileRow = <Data extends RowData>({
  row,
}: {
  row: Row<DataTableFeatures, Data>;
}) => {
  const cells = row.getVisibleCells();
  const [titleCell] = cellsWithRole(cells, "title");
  const subtitleCells = cellsWithRole(cells, "subtitle");
  const badgeCells = cellsWithRole(cells, "badge");
  const actionCells = cellsWithRole(cells, "actions");
  const fieldCells = cellsWithRole(cells, "field");

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {titleCell ? (
            <div
              className={cn(
                "min-w-0 font-medium",
                overflowClassName(wrapsOnMobile(titleCell)),
              )}
            >
              <FlexRender cell={titleCell} />
            </div>
          ) : null}
          {subtitleCells.map((cell) => (
            <div
              key={cell.id}
              className={cn(
                "min-w-0 text-sm text-muted-foreground",
                overflowClassName(wrapsOnMobile(cell)),
              )}
            >
              <FlexRender cell={cell} />
            </div>
          ))}
          {badgeCells.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {badgeCells.map((cell) => (
                <FlexRender key={cell.id} cell={cell} />
              ))}
            </div>
          ) : null}
        </div>
        {actionCells.length > 0 ? (
          <div className="-mt-1 -mr-2 flex shrink-0 items-center">
            {actionCells.map((cell) => (
              <FlexRender key={cell.id} cell={cell} />
            ))}
          </div>
        ) : null}
      </div>
      {fieldCells.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {fieldCells.map((cell) => {
            const wraps = wrapsOnMobile(cell);

            return (
              <div
                key={cell.id}
                className={cn(
                  "flex min-w-0 flex-col gap-0.5",
                  wraps && "col-span-2",
                )}
              >
                <dt className="text-xs text-muted-foreground">
                  {cell.column.columnDef.meta?.label ?? cell.column.id}
                </dt>
                <dd
                  className={cn(
                    "min-w-0",
                    wraps ? "wrap-anywhere" : "wrap-break-word",
                  )}
                >
                  <FlexRender cell={cell} />
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </li>
  );
};

export const DataTableMobileList = <Data extends RowData>({
  rows,
  getSectionHeading,
}: {
  rows: Row<DataTableFeatures, Data>[];
  getSectionHeading?: (row: Data) => string | null;
}) => (
  <ul
    data-slot="data-table-mobile-list"
    className="flex flex-col gap-3 md:hidden"
  >
    {rows.map((row) => {
      const sectionHeading = getSectionHeading?.(row.original) ?? null;
      if (sectionHeading !== null) {
        return (
          <li
            key={row.id}
            data-slot="data-table-mobile-section-heading"
            className="pt-2 text-sm font-semibold wrap-anywhere first:pt-0"
          >
            {sectionHeading}
          </li>
        );
      }

      return <MobileRow key={row.id} row={row} />;
    })}
  </ul>
);
