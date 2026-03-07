import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { AddApiKeyModal } from "./add-api-key-modal";

const routerRefreshMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const clipboardWriteTextMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="form-with-action" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: {
    status: boolean;
    data?: { id: string; key?: string };
    message?: string;
  } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccessMock(msg),
    error: (msg: string) => toastErrorMock(msg),
  },
}));

vi.mock(
  "@/app/dashboard/api-keys/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
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
  DialogTrigger: ({
    children,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    onClick,
    "aria-label": ariaLabel,
    "aria-live": ariaLive,
  }: React.PropsWithChildren<{
    type?: string;
    disabled?: boolean;
    onClick?: () => void;
    "aria-label"?: string;
    "aria-live"?: string;
  }>) => (
    <button
      type={type as "submit" | "button"}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-live={ariaLive}
    >
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: ({
    value,
    readOnly,
    "aria-label": ariaLabel,
  }: {
    value?: string;
    readOnly?: boolean;
    "aria-label"?: string;
  }) => (
    <input
      data-testid="input"
      value={value}
      readOnly={readOnly}
      aria-label={ariaLabel}
    />
  ),
}));

vi.mock("./api-key-form-fields", () => ({
  ApiKeyFormFields: ({
    mode,
    pending,
    submitLabel,
  }: {
    mode: string;
    pending: boolean;
    submitLabel: string;
  }) => (
    <div
      data-testid="api-key-form-fields"
      data-mode={mode}
      data-pending={String(pending)}
    >
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/api-keys/actions/create/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("AddApiKeyModal", () => {
  beforeEach(() => {
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteTextMock },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    clipboardWriteTextMock.mockReset();
  });

  it("renders Add API key trigger button", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    render(<AddApiKeyModal />);

    expect(
      screen.getByRole("button", { name: "Add API key" }),
    ).toBeInTheDocument();
  });

  it("renders dialog title Add API key when not in success step", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    render(<AddApiKeyModal />);

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Add API key");
  });

  it("renders form fields in create mode", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    render(<AddApiKeyModal />);

    expect(screen.getByTestId("api-key-form-fields")).toHaveAttribute(
      "data-mode",
      "create",
    );
  });

  it("shows key created step with key value and Copy/Done when success with data.key", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: { id: "key-id", key: "secret-key-abc123" },
        },
      }),
    );

    render(<AddApiKeyModal />);

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "API key created",
    );
    expect(screen.getByLabelText("API key value")).toHaveValue(
      "secret-key-abc123",
    );
    expect(
      screen.getByRole("button", { name: "Copy key" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("shows warning text about key visibility in success step", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: { id: "key-id", key: "x" },
        },
      }),
    );

    render(<AddApiKeyModal />);

    expect(
      screen.getByText(/This is the only time you'll see this key/),
    ).toBeInTheDocument();
  });

  it("shows Copied! and toasts success when Copy is clicked and clipboard write succeeds", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: { id: "key-id", key: "secret-key-abc123" },
        },
      }),
    );

    render(<AddApiKeyModal />);

    const copyButton = screen.getByRole("button", { name: "Copy key" });
    fireEvent.click(copyButton);

    expect(
      await screen.findByRole("button", { name: /Copied/i }),
    ).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith("Copied to clipboard");
    expect(clipboardWriteTextMock).toHaveBeenCalledWith("secret-key-abc123");
  });

  it("toasts error when Copy is clicked and clipboard write fails", async () => {
    clipboardWriteTextMock.mockRejectedValueOnce(new Error("clipboard denied"));
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: { id: "key-id", key: "secret-key-abc123" },
        },
      }),
    );

    render(<AddApiKeyModal />);

    const copyButton = screen.getByRole("button", { name: "Copy key" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to copy");
    });
    expect(
      screen.getByRole("button", { name: "Copy key" }),
    ).toBeInTheDocument();
  });
});
