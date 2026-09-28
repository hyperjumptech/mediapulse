import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PreviewExpansionResponse } from "@hermes/domain-contract";

import { DomainTableFullPageEditor } from "./domain-table-full-page-editor";

const { previewResultMock } = vi.hoisted(() => ({
  previewResultMock: vi.fn<() => PreviewExpansionResponse | null>(() => null),
}));

vi.mock("@/hooks/use-domain-table-full-page-editor", () => ({
  useDomainTableFullPageEditor: () => ({
    formRef: { current: null },
    previewResult: previewResultMock(),
    previewLoading: false,
    previewError: null,
    runPreviewClick: vi.fn(),
  }),
}));

vi.mock("@/lib/domain-table-full-page-actions", () => ({
  runDomainTablePreviewExpansion: vi.fn(),
}));

vi.mock("@/components/domain-table-form-fields", () => ({
  DomainTableFormFields: () => <div>Fields</div>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

const baseProps = {
  basePath: "/dashboard/mediapulse/data-source-expansions",
  fields: [],
  mode: "edit" as const,
  rowId: "row-1",
  defaultRow: { name: "n" },
  formAction: async () => undefined,
  integrationId: "mediapulse",
  showPreview: false,
};

describe("DomainTableFullPageEditor", () => {
  afterEach(() => {
    previewResultMock.mockReset();
    previewResultMock.mockReturnValue(null);
  });

  it("renders empty usage state when no pipelines reference the item", () => {
    render(<DomainTableFullPageEditor {...baseProps} usedInPipelines={[]} />);

    expect(screen.getByText("Used in pipelines")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This expansion string is not referenced by any pipelines yet.",
      ),
    ).toBeInTheDocument();
  });

  it("renders linked pipeline rows when usage exists", () => {
    render(
      <DomainTableFullPageEditor
        {...baseProps}
        usedInPipelines={[
          {
            id: "pipeline-1",
            name: "Pipeline one",
            matchCount: 1,
            matchedStepIds: ["step-1"],
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Pipeline one" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-1",
    );
  });

  it("prompts for a preview before one has run", () => {
    render(
      <DomainTableFullPageEditor
        {...baseProps}
        showPreview
        previewFieldKey="expansionString"
      />,
    );

    expect(
      screen.getByText("Run preview to see resolved values here."),
    ).toBeInTheDocument();
  });

  it("shows resolved preview values in a copyable JSON block", () => {
    previewResultMock.mockReturnValue({
      success: true,
      values: ["alpha", "beta"],
    });

    render(
      <DomainTableFullPageEditor
        {...baseProps}
        showPreview
        previewFieldKey="expansionString"
      />,
    );

    const jsonBody = screen.getByRole("region", { name: "JSON" });

    expect(jsonBody).toHaveTextContent('[ "alpha", "beta" ]');
    expect(jsonBody).toHaveClass("max-h-[min(60vh,480px)]");
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeVisible();
    expect(
      screen.queryByText("Run preview to see resolved values here."),
    ).not.toBeInTheDocument();
  });
});
