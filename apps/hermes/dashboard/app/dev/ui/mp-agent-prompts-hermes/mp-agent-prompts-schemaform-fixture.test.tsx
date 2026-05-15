/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/json-schema-form", () => ({
  SchemaForm: () => <div data-testid="schema-form" />,
}));

import { MpAgentPromptsSchemaformFixture } from "./mp-agent-prompts-schemaform-fixture";

describe("MpAgentPromptsSchemaformFixture", () => {
  it("renders SchemaForm for article-analysis with prompt seed fields", () => {
    render(<MpAgentPromptsSchemaformFixture agentId="article-analysis" />);

    expect(
      screen.getByRole("heading", { name: /Agent config — SchemaForm/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/article-analysis@1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByTestId("schema-form")).toBeInTheDocument();
  });

  it("renders SchemaForm for content-generation", () => {
    render(<MpAgentPromptsSchemaformFixture agentId="content-generation" />);

    expect(screen.getByText(/content-generation@1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByTestId("schema-form")).toBeInTheDocument();
  });

  it("renders prompts-only mode when focus is prompts", () => {
    render(
      <MpAgentPromptsSchemaformFixture
        agentId="article-analysis"
        focus="prompts"
      />,
    );

    expect(screen.getByText(/^Prompts$/i)).toBeInTheDocument();
    expect(screen.getByText(/focus=prompts/i)).toBeInTheDocument();
  });

  it("shows an error message for an unknown agent id", () => {
    render(<MpAgentPromptsSchemaformFixture agentId="unknown-agent" />);

    expect(screen.getByText(/Unknown agent/i)).toBeInTheDocument();
    expect(screen.queryByTestId("schema-form")).not.toBeInTheDocument();
  });
});
