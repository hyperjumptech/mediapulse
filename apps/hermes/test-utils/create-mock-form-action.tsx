import React from "react";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: unknown;
} | null;

type MockUseFormActionReturn = {
  FormWithAction: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
  }>;
  state: MockFormActionState;
  pending: boolean;
};

/**
 * Creates a mock FormWithAction component for testing form components
 * that use the generated useFormAction hook.
 *
 * @param testId - Test ID for the form element (e.g., "login-form")
 * @returns A simple form component used in tests
 */
export const createMockFormWithAction = (testId: string) => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid={testId} className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

/**
 * Creates a default shape that mirrors the useFormAction hook output.
 *
 * @param testId - Test ID for the form element
 * @param overrides - Optional state overrides for a specific test
 * @returns A mocked useFormAction return value
 */
export const createMockUseFormAction = <T = unknown,>(
  testId: string,
  overrides?: {
    state?: {
      status: boolean;
      message?: string;
      data?: T;
    } | null;
    pending?: boolean;
  },
): MockUseFormActionReturn => ({
  FormWithAction: createMockFormWithAction(testId),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});
