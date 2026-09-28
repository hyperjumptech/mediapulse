"use client";

import { FlexRender, type Row, type RowData } from "@tanstack/react-table";

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
        <div className="flex min-w-0 flex-col gap-1">
          {titleCell ? (
            <div className="min-w-0 truncate font-medium">
              <FlexRender cell={titleCell} />
            </div>
          ) : null}
          {subtitleCells.map((cell) => (
            <div
              key={cell.id}
              className="truncate text-sm text-muted-foreground"
            >
              <FlexRender cell={cell} />
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badgeCells.map((cell) => (
            <FlexRender key={cell.id} cell={cell} />
          ))}
          {actionCells.map((cell) => (
            <FlexRender key={cell.id} cell={cell} />
          ))}
        </div>
      </div>
      {fieldCells.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {fieldCells.map((cell) => (
            <div key={cell.id} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {cell.column.columnDef.meta?.label ?? cell.column.id}
              </dt>
              <dd className="min-w-0 truncate">
                <FlexRender cell={cell} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
};

export const DataTableMobileList = <Data extends RowData>({
  rows,
}: {
  rows: Row<DataTableFeatures, Data>[];
}) => (
  <ul
    data-slot="data-table-mobile-list"
    className="flex flex-col gap-3 md:hidden"
  >
    {rows.map((row) => (
      <MobileRow key={row.id} row={row} />
    ))}
  </ul>
);
