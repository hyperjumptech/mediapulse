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

config({ path: path.resolve(__dirname, ".env.local") });
config({ path: path.resolve(__dirname, "../.env.local") });
config({ path: path.resolve(__dirname, "../../../.env") });
