import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionCoverageContent } from "./section-coverage-content";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
  }: React.PropsWithChildren<{ type?: "submit" | "button" }>) => (
    <button type={type ?? "button"}>{children}</button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
}));

describe("SectionCoverageContent", () => {
  it("shows empty-state copy when ticker is set but rows are empty", () => {
    render(
      <SectionCoverageContent tickerId="ticker-1" windowDays={30} rows={[]} />,
    );

    expect(
      screen.getByText(/No coverage data found for this ticker/i),
    ).toBeInTheDocument();
  });

  it("renders section labels when rollup rows exist", () => {
    render(
      <SectionCoverageContent
        tickerId="ticker-1"
        windowDays={30}
        rows={[
          {
            contractVersion: "1",
            coverageRunCount: 2,
            fillRunCount: 1,
            bySection: {
              industryPulse: { avgCoverage: 3, avgFill: 2 },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Industry Pulse")).toBeInTheDocument();
    expect(screen.getByText("Contract v1")).toBeInTheDocument();
  });

  it("submits the filter form and updates the route", () => {
    render(
      <SectionCoverageContent tickerId="" windowDays={30} rows={[]} />,
    );

    fireEvent.change(screen.getByLabelText(/Ticker ID/i), {
      target: { value: "new-ticker" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Load/i }));

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("ticker=new-ticker"),
    );
  });
});
