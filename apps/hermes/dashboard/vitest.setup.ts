import "@testing-library/jest-dom";
import { config } from "dotenv";
import path from "path";
import { vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  unstable_noStore: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  unstable_cache: vi.fn(
    <CachedCallback>(cachedCallback: CachedCallback) => cachedCallback,
  ),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

config({ path: path.resolve(__dirname, ".env.local") });
config({ path: path.resolve(__dirname, "../.env.local") });
config({ path: path.resolve(__dirname, "../../../.env") });
