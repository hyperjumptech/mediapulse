import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { PipelineRowActions } from "./pipeline-row-actions";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="delete-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/pipelines/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    variant,
    asChild,
  }: React.PropsWithChildren<{ variant?: string; asChild?: boolean }>) => (
    <div data-testid="dropdown-item" data-variant={variant}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    "aria-label": ariaLabel,
  }: React.PropsWithChildren<{ "aria-label"?: string }>) => (
    <button aria-label={ariaLabel}>{children}</button>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/pipelines/actions/delete/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("PipelineRowActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders dropdown menu trigger", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });

  it("renders Edit option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("renders Delete option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders Edit as link when onEdit not provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    const editLink = screen.getByRole("link", { name: /Edit/i });
    expect(editLink).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-123",
    );
  });

  it("shows Deleting label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
  });

  it("calls router.refresh on successful delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("renders hidden input with pipeline id", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineRowActions pipelineId="pipeline-123" pipelineName="Test" />,
    );

    // Assert
    const form = screen.getByTestId("delete-form");
    const hiddenInput = form.querySelector('input[name="body.pipelineId"]');
    expect(hiddenInput).toHaveValue("pipeline-123");
  });
});
