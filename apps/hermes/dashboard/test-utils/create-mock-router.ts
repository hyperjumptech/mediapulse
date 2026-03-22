import { vi } from "vitest";

type MockRouter = {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
};

/**
 * Creates a mock Next.js router for testing components that use useRouter.
 *
 * @returns A mocked router object with vi.fn() for all methods
 */
export const createMockRouter = (): MockRouter => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
});

/**
 * Creates a mock usePathname return value.
 *
 * @param pathname - The pathname to return
 * @returns A function that returns the pathname
 */
export const createMockPathname = (pathname: string) => () => pathname;

/**
 * Creates a mock useSearchParams return value.
 *
 * @param params - The search params to return
 * @returns A mocked URLSearchParams-like object
 */
export const createMockSearchParams = (params: Record<string, string> = {}) => {
  const searchParams = new URLSearchParams(params);
  return () => searchParams;
};
