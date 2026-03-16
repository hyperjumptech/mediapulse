import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditApiKeyModal } from "./edit-api-key-modal";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock(
  "@/app/dashboard/api-keys/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => ({
      FormWithAction: ({
        children,
        className,
      }: {
        children: React.ReactNode;
        className?: string;
      }) => (
        <form data-testid="form-with-action" className={className}>
          {children}
        </form>
      ),
      state: null,
      pending: false,
    })),
  }),
);

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

vi.mock("./api-key-form-fields", () => ({
  ApiKeyFormFields: ({
    mode,
    initialName,
    initialIsActive,
  }: {
    mode: string;
    initialName: string;
    initialIsActive: boolean;
  }) => (
    <div
      data-testid="api-key-form-fields"
      data-mode={mode}
      data-initial-name={initialName}
      data-initial-is-active={String(initialIsActive)}
    />
  ),
}));

const mockApiKey = {
  id: "key-1",
  name: "My Key",
  key: "hashed",
  purpose: null as string | null,
  isActive: true,
  userId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: "user-1", name: "Admin", email: "admin@example.com" },
};

describe("EditApiKeyModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when apiKey is null", () => {
    const { container } = render(
      <EditApiKeyModal apiKey={null} open={true} onOpenChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with title and form when apiKey provided", () => {
    render(
      <EditApiKeyModal
        apiKey={mockApiKey}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Edit API key: My Key",
    );
    expect(screen.getByTestId("api-key-form-fields")).toHaveAttribute(
      "data-mode",
      "edit",
    );
    expect(screen.getByTestId("api-key-form-fields")).toHaveAttribute(
      "data-initial-name",
      "My Key",
    );
    expect(screen.getByTestId("api-key-form-fields")).toHaveAttribute(
      "data-initial-is-active",
      "true",
    );
  });
});
