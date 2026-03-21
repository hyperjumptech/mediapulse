import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { EntityTypeModal } from "./entity-type-modal";

const routerRefreshMock = vi.fn();

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
  state?: { status: boolean; data?: { id: string }; message?: string } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/entity-types/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock(
  "@/app/dashboard/entity-types/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit" | "button"} disabled={disabled}>
      {children}
    </button>
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

const getCreateUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/entity-types/actions/create/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("EntityTypeModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("in create mode renders form fields and submit button", async () => {
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    render(
      <EntityTypeModal
        entityType={null}
        trigger={<button type="button">Open</button>}
      />,
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create entity type" }),
    ).toBeInTheDocument();
  });

  it("in edit mode renders title and form for the row", () => {
    render(
      <EntityTypeModal
        entityType={{
          id: "et-1",
          name: "COMPANY",
          description: "Organization",
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit entity type: COMPANY")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("COMPANY");
    expect(screen.getByLabelText("Description")).toHaveValue("Organization");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });
});
