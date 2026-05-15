/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@/app/dashboard/api-keys/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => ({
      FormWithAction: ({
        children,
        className,
      }: {
        children: React.ReactNode;
        className?: string;
      }) => (
        <form className={className} data-testid="create-key-form">
          {children}
        </form>
      ),
      state: null,
      pending: false,
    }),
  }),
);

import { CreateApiKeyModal } from "./create-api-key-modal";

describe("CreateApiKeyModal", () => {
  it("renders create form fields when closed state shows label input", () => {
    render(<CreateApiKeyModal trigger={<button type="button">Open</button>} />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });
});
