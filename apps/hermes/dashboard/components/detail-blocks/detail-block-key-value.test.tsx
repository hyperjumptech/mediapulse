/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockKeyValueView } from "./detail-block-key-value";

describe("DetailBlockKeyValueView", () => {
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
});
