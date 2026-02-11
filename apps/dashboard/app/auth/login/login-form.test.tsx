import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import { LoginForm } from "./login-form";

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="login-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean; message?: string } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock("./action/.generated/use-form-action", () => ({
  useFormAction: vi.fn(() => createMockUseFormAction()),
}));

const getUseFormActionMock = async () => {
  const mod = await import("./action/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the card with title and description", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    const title = screen.getByText("Log in", { selector: "[data-slot='card-title']" });
    expect(title).toBeInTheDocument();
    expect(
      screen.getByText("Enter your credentials to access your account"),
    ).toBeInTheDocument();
  });

  it("renders email input with correct name and type", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("name", "body.email");
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders password input with correct name and type", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("name", "body.password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("renders a submit button with 'Log in' text", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    const button = screen.getByRole("button", { name: "Log in" });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("does not display an error message on initial render", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: null }));

    // Act
    render(<LoginForm />);

    // Assert
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays error message when state has status false", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Invalid credentials" },
      }),
    );

    // Act
    render(<LoginForm />);

    // Assert
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid credentials");
  });

  it("disables the button and shows loading text when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<LoginForm />);

    // Assert
    const button = screen.getByRole("button", { name: /logging in/i });
    expect(button).toBeDisabled();
  });

  it("does not show error when state has status true", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          message: undefined,
        },
      }),
    );

    // Act
    render(<LoginForm />);

    // Assert
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
