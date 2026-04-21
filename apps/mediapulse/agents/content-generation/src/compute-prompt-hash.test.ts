import { describe, expect, it } from "vitest";

import { computePromptHash } from "./compute-prompt-hash.js";

const SYSTEM_PROMPT = "You are a newsletter writer for busy executives.";
const USER_PROMPT =
  "Create a newsletter from these data sources.\n\nSource: Story A\nContent A.";

describe("computePromptHash", () => {
  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  it("returns the same hash for the same prompts called twice", () => {
    // Act
    const hash1 = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);
    const hash2 = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);

    // Assert
    expect(hash1).toBe(hash2);
  });

  it("returns a 16-character hex string", () => {
    // Act
    const hash = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  // -------------------------------------------------------------------------
  // Sensitivity: different inputs → different hash
  // -------------------------------------------------------------------------

  it("produces a different hash when the system prompt changes", () => {
    // Setup
    const hashA = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);
    const hashB = computePromptHash(
      "You are a different kind of writer.",
      USER_PROMPT,
    );

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  it("produces a different hash when the user prompt changes", () => {
    // Setup
    const hashA = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);
    const hashB = computePromptHash(
      SYSTEM_PROMPT,
      "Create a newsletter from different sources.\n\nSource: Story B\nContent B.",
    );

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  it("produces a different hash when source content changes (simulating different articles)", () => {
    // Setup — simulates two runs with different fetched articles in the user prompt
    const promptWithSourceA = `Create a newsletter.\n\nSource: Tech Rally\nStocks jumped 3% on earnings.`;
    const promptWithSourceB = `Create a newsletter.\n\nSource: Oil Crisis\nCrude futures fell sharply.`;

    const hashA = computePromptHash(SYSTEM_PROMPT, promptWithSourceA);
    const hashB = computePromptHash(SYSTEM_PROMPT, promptWithSourceB);

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  it("produces a different hash when only whitespace in the separator differs", () => {
    // The combinator uses "\n\n" — confirm order matters
    const hashA = computePromptHash("system", "user");
    const hashB = computePromptHash("systemuser", "");

    // Assert — different concatenations must produce different hashes
    expect(hashA).not.toBe(hashB);
  });

  // -------------------------------------------------------------------------
  // Order matters: swapping system and user prompts gives a different hash
  // -------------------------------------------------------------------------

  it("produces a different hash when system and user prompts are swapped", () => {
    // Act
    const hashA = computePromptHash(SYSTEM_PROMPT, USER_PROMPT);
    const hashB = computePromptHash(USER_PROMPT, SYSTEM_PROMPT);

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  // -------------------------------------------------------------------------
  // Empty string inputs
  // -------------------------------------------------------------------------

  it("handles empty strings without throwing", () => {
    // Act & Assert
    expect(() => computePromptHash("", "")).not.toThrow();
  });

  it("produces a hash even when both inputs are empty strings", () => {
    // Act
    const hash = computePromptHash("", "");

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
