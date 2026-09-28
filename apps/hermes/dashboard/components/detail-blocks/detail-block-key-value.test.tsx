import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DetailBlockKeyValueView } from "./detail-block-key-value";

describe("DetailBlockKeyValueView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats a tokens row as prompt + completion = total", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            {
              field: "totalTokens",
              label: "Tokens",
              format: "tokens",
              tokenFields: {
                prompt: "promptTokens",
                completion: "completionTokens",
                total: "totalTokens",
              },
            },
          ],
        }}
        data={{
          promptTokens: 1200,
          completionTokens: 800,
          totalTokens: 2000,
        }}
      />,
    );
    expect(screen.getByText("1,200 + 800 = 2,000")).toBeInTheDocument();
  });

  it("falls back to em-dash when a token field is missing", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            {
              field: "totalTokens",
              label: "Tokens",
              format: "tokens",
              tokenFields: {
                prompt: "promptTokens",
                completion: "completionTokens",
                total: "totalTokens",
              },
            },
          ],
        }}
        data={{
          promptTokens: 1200,
          completionTokens: null,
          totalTokens: 2000,
        }}
      />,
    );
    expect(screen.getByText("1,200 + — = 2,000")).toBeInTheDocument();
  });

  it("renders a link when linkTemplate resolves", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            {
              field: "tickerName",
              label: "Ticker",
              linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
            },
          ],
        }}
        data={{
          integrationId: "mediapulse",
          tickerId: "uuid-1",
          tickerName: "Apple Inc.",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Apple Inc." });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers/uuid-1",
    );
  });

  it("renders boolean values as Yes/No", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            { field: "enabled", label: "Enabled" },
            { field: "verified", label: "Verified" },
          ],
        }}
        data={{ enabled: true, verified: false }}
      />,
    );

    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("falls back to plain text when a linkTemplate variable is missing", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            {
              field: "tickerName",
              label: "Ticker",
              linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
            },
          ],
        }}
        data={{
          integrationId: "mediapulse",
          tickerName: "Apple Inc.",
        }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("formats a date-time row instead of printing the ISO string", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            { field: "receivedAt", label: "Received", format: "date-time" },
          ],
        }}
        data={{ receivedAt: "2026-09-28T07:55:00.000Z" }}
      />,
    );

    expect(screen.getByText("Sep 28, 2026, 07:55")).toBeInTheDocument();
    expect(
      screen.queryByText("2026-09-28T07:55:00.000Z"),
    ).not.toBeInTheDocument();
  });

  it("lays rows out on the shared fact grid, one column on phones and two from sm", () => {
    const { container } = render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [{ field: "subject", label: "Subject" }],
        }}
        data={{ subject: "Apple earnings" }}
      />,
    );

    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveAttribute("data-variant", "plain");
    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "max-w-3xl");
  });

  it("renders labels in muted small text instead of uppercase", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [{ field: "subject", label: "Subject" }],
        }}
        data={{ subject: "Apple earnings" }}
      />,
    );

    const label = screen.getByRole("term");

    expect(label).toHaveTextContent("Subject");
    expect(label).toHaveClass("text-xs", "text-muted-foreground");
    expect(label).not.toHaveClass("uppercase");
  });

  it("breaks URLs and ids anywhere so they never run past the screen edge", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            { field: "listingUrl", label: "Listing URL", copyAction: true },
          ],
        }}
        data={{
          listingUrl:
            "https://example.com/a/very/long/listing/path/that/never/breaks",
        }}
      />,
    );

    const value = screen.getByRole("definition");

    expect(value).toHaveClass("min-w-0", "break-all");
    expect(
      screen.getByText(
        "https://example.com/a/very/long/listing/path/that/never/breaks",
      ),
    ).toHaveClass("min-w-0");
  });

  it("wraps prose values between words", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [{ field: "reason", label: "Reason" }],
        }}
        data={{ reason: "The page returned no article body." }}
      />,
    );

    const value = screen.getByRole("definition");

    expect(value).toHaveClass("min-w-0", "break-words");
    expect(value).not.toHaveClass("break-all");
  });

  it("copies the raw value from a small icon button beside it", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            {
              field: "executionId",
              label: "Execution",
              linkTemplate: "/dashboard/executions/{executionId}",
              copyAction: true,
            },
          ],
        }}
        data={{ executionId: "exec-123" }}
      />,
    );

    const button = screen.getByRole("button", { name: "Copy Execution" });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith("exec-123");
    expect(button).toHaveClass("size-7", "shrink-0");
    expect(button).toHaveTextContent("");
    expect(screen.getByRole("link", { name: "exec-123" })).toHaveAttribute(
      "href",
      "/dashboard/executions/exec-123",
    );
  });

  it("omits the copy button when the value is empty", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [
            { field: "executionId", label: "Execution", copyAction: true },
          ],
        }}
        data={{ executionId: null }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("formats a number row with grouping separators", () => {
    render(
      <DetailBlockKeyValueView
        block={{
          type: "keyValue",
          rows: [{ field: "count", label: "Count", format: "number" }],
        }}
        data={{ count: "12345" }}
      />,
    );

    expect(screen.getByText("12,345")).toBeInTheDocument();
  });
});
