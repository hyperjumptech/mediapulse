import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockSubTableView } from "./detail-block-sub-table";

const rowsData = {
  queries: Array.from({ length: 12 }, (_, index) => ({
    id: `q${String(index)}`,
    text: `query ${String(index)}`,
  })),
};

const table = () => within(screen.getByRole("table"));

describe("subTable rowLimitOptions", () => {
  it("defaults to the first option's row count", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Results",
          hideHeader: true,
          rowLimitOptions: [5, 10],
          columns: [{ field: "text", label: "Query", type: "text" }],
        }}
        data={rowsData}
      />,
    );

    expect(table().getByText("query 0")).toBeInTheDocument();
    expect(table().getByText("query 4")).toBeInTheDocument();
    expect(table().queryByText("query 5")).not.toBeInTheDocument();
  });

  it("renders a row-count selector showing the default value", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Results",
          hideHeader: true,
          rowLimitOptions: [5, 10],
          columns: [{ field: "text", label: "Query", type: "text" }],
        }}
        data={rowsData}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("5");
  });

  it("starts on every row when rowLimitDefaultAll is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Results",
          hideHeader: true,
          rowLimitOptions: [5, 10],
          rowLimitDefaultAll: true,
          columns: [{ field: "text", label: "Query", type: "text" }],
        }}
        data={rowsData}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("All");
    expect(table().getAllByRole("row")).toHaveLength(12);
  });

  it("shows the empty state instead of a table when there are no rows", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Results",
          rowLimitOptions: [5, 10],
          emptyState: "No queries yet.",
          columns: [{ field: "text", label: "Query", type: "text" }],
        }}
        data={{ queries: [] }}
      />,
    );

    expect(screen.getByText("No queries yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
