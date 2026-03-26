import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DomainTableFullPageEditor } from "./domain-table-full-page-editor";

vi.mock("@/hooks/use-domain-table-full-page-editor", () => ({
  useDomainTableFullPageEditor: () => ({
    formRef: { current: null },
    previewResult: null,
    previewLoading: false,
    previewError: null,
    runPreviewClick: vi.fn(),
  }),
}));

vi.mock("@/lib/domain-table-full-page-actions", () => ({
  runDomainTablePreviewExpansion: vi.fn(),
}));

vi.mock("@/components/page-header", () => ({
  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
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
  title: "Edit data source expansions",
  description: "desc",
  basePath: "/dashboard/mediapulse/data-source-expansions",
  fields: [],
  mode: "edit" as const,
  rowId: "row-1",
  defaultRow: { name: "n" },
  formAction: async () => undefined,
  integrationKey: "mediapulse",
  showPreview: false,
};

describe("DomainTableFullPageEditor", () => {
  it("renders empty usage state when no pipelines reference the item", () => {
    // Act
    render(<DomainTableFullPageEditor {...baseProps} usedInPipelines={[]} />);

    // Assert
    expect(screen.getByText("Used in pipelines")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This expansion string is not referenced by any pipelines yet.",
      ),
    ).toBeInTheDocument();
  });

  it("renders linked pipeline rows when usage exists", () => {
    // Act
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

    // Assert
    expect(screen.getByRole("link", { name: "Pipeline one" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-1",
    );
  });
});
