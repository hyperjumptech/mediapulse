---
name: vitest-unit-testing
description: Write reliable unit tests following best practices with Vitest. Enforces mock cleanup, false-positive prevention, structured test sections (setup/act/assert), and test isolation. Use when writing, generating, or reviewing unit tests, test files, .test.ts files, .spec.ts files, or when the user mentions Vitest, unit testing, or test coverage.
---

# Unit Testing with Vitest

## Test Structure

Every test must have clearly commented sections: **Setup**, **Act**, and **Assert**.

```typescript
it("calculates the total with tax", () => {
  // Setup
  const cart = createCart([{ price: 100, qty: 2 }]);
  const taxRate = 0.08;

  // Act
  const total = cart.calculateTotal(taxRate);

  // Assert
  expect(total).toBe(216);
});
```

For tests with no meaningful setup, omit the Setup comment but always keep Act and Assert separate:

```typescript
it("returns zero for an empty cart", () => {
  // Act
  const total = createCart([]).calculateTotal(0);

  // Assert
  expect(total).toBe(0);
});
```

## Mock Hygiene

**Always clean up mocks.** Use `afterEach` with `vi.restoreAllMocks()` at the top of every `describe` block that uses mocks.

```typescript
describe("OrderService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends confirmation email", () => {
    // Setup
    const sendEmail = vi.spyOn(emailService, "send").mockResolvedValue(true);

    // Act
    await orderService.confirm(order);

    // Assert
    expect(sendEmail).toHaveBeenCalledWith(order.email, expect.any(String));
  });
});
```

Prefer `vi.restoreAllMocks()` over `vi.clearAllMocks()` — it restores original implementations, preventing mock leakage between tests.

For module-level mocks (`vi.mock()`), use `vi.resetModules()` in `afterEach` when tests need different mock configurations.

## Preventing False Positives

A test that never fails is worthless. Apply these rules:

### 1. Assert the specific value, not just truthiness

```typescript
// Bad — passes even if name is "wrong-name"
expect(user.name).toBeTruthy();

// Good
expect(user.name).toBe("Alice");
```

### 2. Assert the negative case

When testing conditional logic, always test both branches:

```typescript
it("grants access for admin role", () => {
  expect(canAccess({ role: "admin" })).toBe(true);
});

it("denies access for guest role", () => {
  expect(canAccess({ role: "guest" })).toBe(false);
});
```

### 3. Verify async rejections explicitly

```typescript
it("rejects invalid input", async () => {
  // Act & Assert
  await expect(validate(null)).rejects.toThrow("Input required");
});
```

### 4. Use `expect.assertions(n)` for conditional/async paths

When a test has assertions inside callbacks or catch blocks, declare the expected count:

```typescript
it("handles each item", () => {
  expect.assertions(3);

  items.forEach((item) => {
    expect(item.isValid()).toBe(true);
  });
});
```

### 5. Never rely solely on `not.toThrow`

Pair it with a positive assertion on the return value:

```typescript
// Bad — passes even if the function does nothing
expect(() => parse(input)).not.toThrow();

// Good
const result = parse(input);
expect(result).toEqual({ id: 1, name: "Test" });
```

## Test Isolation

**Cardinal rule: every test must produce the same result whether run alone or as part of the full suite.** If `vitest run src/foo.test.ts` passes but `vitest run` fails (or vice versa), you have a isolation bug.

### Core Principles

- Each test must be independent — never rely on execution order.
- Use `beforeEach` for shared setup, never shared mutable state across tests.
- Prefer factory functions over shared fixture objects:

```typescript
// Good — each test gets a fresh object
function createUser(overrides?: Partial<User>): User {
  return { id: "1", name: "Alice", role: "user", ...overrides };
}

it("promotes user to admin", () => {
  // Setup
  const user = createUser({ role: "user" });

  // Act
  promote(user);

  // Assert
  expect(user.role).toBe("admin");
});
```

### Common Isolation Bugs

**1. Module-level mutable state** — If the module under test holds state (singletons, caches, counters), reset it in `beforeEach` or use `vi.resetModules()` to get a fresh module instance:

```typescript
describe("counter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts at zero", async () => {
    // Setup
    const { counter } = await import("./counter");

    // Assert
    expect(counter.value).toBe(0);
  });
});
```

**2. Global/environment pollution** — Save and restore any globals or env vars you modify:

```typescript
describe("config", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("uses production settings", () => {
    // Setup
    process.env.NODE_ENV = "production";

    // Act
    const config = loadConfig();

    // Assert
    expect(config.debug).toBe(false);
  });
});
```

**3. Fake timers not restored** — Always pair `vi.useFakeTimers()` with `vi.useRealTimers()` in `afterEach`. A leaked fake timer breaks every subsequent test that touches time.

**4. Database/file system side effects** — Clean up any created resources in `afterEach` or use transactions that roll back. Never assume a clean slate exists from a previous test.

**5. Randomness without seeding** — If tests use random data, use a seeded generator or deterministic factory. Flaky tests that only fail in CI are usually randomness + ordering.

## Naming Conventions

- **Describe blocks**: name of the unit (function, class, component).
- **Test names**: describe the behavior, not the implementation. Start with a verb.

```typescript
describe('calculateDiscount', () => {
  it('applies 10% discount for orders over $100', () => { ... });
  it('returns zero discount for orders under $100', () => { ... });
  it('throws for negative order amounts', () => { ... });
});
```

## Focused and Minimal Tests

- **One behavior per test.** If the test name has "and", split it.
- **Minimal setup.** Only set up what the test actually needs.
- **No logic in tests.** No `if`, `for`, `switch`, or `try/catch` in test bodies (except for error assertion patterns). Test logic hides bugs.

## Testing Error Paths

Always test expected failures, not just happy paths:

```typescript
it("throws when dividing by zero", () => {
  // Act & Assert
  expect(() => divide(10, 0)).toThrow("Division by zero");
});
```

## Mocking Guidelines

- Mock at the boundary (network, file system, time) — not internal implementation.
- Prefer dependency injection over `vi.mock()` when the architecture supports it.
- Use `vi.useFakeTimers()` for time-dependent code, and always call `vi.useRealTimers()` in `afterEach`.
- Type your mocks — avoid `as any` casts. Use `vi.mocked()` for type-safe mock access.

## Snapshot Testing

Use sparingly. Snapshots are appropriate for:

- Serialized output (JSON, config objects)
- Small, stable structures

Avoid snapshots for:

- Large objects (hard to review changes)
- UI components (use explicit assertions on key elements instead)

Always review snapshot updates — never blindly accept `--update`.

## Checklist

Before finalizing any test file:

- [ ] Every `describe` with mocks has `afterEach(() => vi.restoreAllMocks())`
- [ ] Every test has `// Setup`, `// Act`, `// Assert` comments
- [ ] No test passes when the assertion is inverted (no false positives)
- [ ] Tests produce identical results when run solo (`vitest run path/to/file`) and in the full suite
- [ ] No module-level mutable state leaks between tests (reset via `vi.resetModules()` or `beforeEach`)
- [ ] Any modified globals/env vars are restored in `afterEach`
- [ ] Test names describe behavior, not implementation
- [ ] One behavior per test
- [ ] Error paths are tested alongside happy paths
- [ ] No logic (`if`/`for`/`try`) inside test bodies
