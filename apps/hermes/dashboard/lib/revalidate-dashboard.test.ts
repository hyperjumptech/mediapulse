/** @vitest-environment node */
import { errorResponse, successResponse } from "route-action-gen/lib";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: (...revalidateArguments: unknown[]) =>
    revalidatePathMock(...revalidateArguments),
}));

import {
  revalidateDashboard,
  withDashboardRevalidation,
} from "./revalidate-dashboard";

describe("revalidateDashboard", () => {
  afterEach(() => {
    revalidatePathMock.mockReset();
  });

  it("revalidates the dashboard layout", () => {
    // Act
    revalidateDashboard();

    // Assert
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });
});

describe("withDashboardRevalidation", () => {
  afterEach(() => {
    revalidatePathMock.mockReset();
  });

  it("revalidates the dashboard layout and returns the result when the handler succeeds", async () => {
    // Setup
    const handler = vi.fn(async (data: { body: { id: string } }) =>
      successResponse({ id: data.body.id }),
    );
    const wrappedHandler = withDashboardRevalidation(handler);

    // Act
    const result = await wrappedHandler({ body: { id: "schedule-1" } });

    // Assert
    expect(result).toEqual(successResponse({ id: "schedule-1" }));
    expect(handler).toHaveBeenCalledWith({ body: { id: "schedule-1" } });
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("does not revalidate when the handler returns an error response", async () => {
    // Setup
    const failureResult = errorResponse("Schedule not found", undefined, 404);
    const handler = vi.fn(async () => failureResult);
    const wrappedHandler = withDashboardRevalidation(handler);

    // Act
    const result = await wrappedHandler();

    // Assert
    expect(result).toBe(failureResult);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("propagates a thrown error without revalidating", async () => {
    // Setup
    const handlerError = new Error("database unavailable");
    const handler = vi.fn(async (): Promise<{ status: boolean }> => {
      throw handlerError;
    });
    const wrappedHandler = withDashboardRevalidation(handler);

    // Act
    const resultPromise = wrappedHandler();

    // Assert
    await expect(resultPromise).rejects.toBe(handlerError);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
