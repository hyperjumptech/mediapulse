/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockSubTableView } from "./detail-block-sub-table";

const rowsData = {
  queries: Array.from({ length: 12 }, (_, index) => ({
    id: `q${String(index)}`,
    text: `query ${String(index)}`,
  })),
};

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

    expect(screen.getByText("query 0")).toBeInTheDocument();
    expect(screen.getByText("query 4")).toBeInTheDocument();
    expect(screen.queryByText("query 5")).not.toBeInTheDocument();
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
});
