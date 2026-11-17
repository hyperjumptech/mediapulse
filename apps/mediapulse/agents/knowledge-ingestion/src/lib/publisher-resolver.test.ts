import { describe, expect, it, vi } from "vitest";

import { createPublisherResolver } from "./publisher-resolver.js";

const PUBLISHER_IRI = "https://mediapulse.hyperjump.tech/id/publisher-kontan";

describe("createPublisherResolver", () => {
  it("looks a domain up once, even for concurrent sends", async () => {
    const client = {
      findPublisherIri: vi.fn().mockResolvedValue(PUBLISHER_IRI),
      createPublisher: vi.fn(),
    };
    const resolve = createPublisherResolver(client);

    const [first, second] = await Promise.all([
      resolve("kontan.co.id"),
      resolve("kontan.co.id"),
    ]);

    expect(first).toEqual({ iri: PUBLISHER_IRI, created: false });
    expect(second).toBe(first);
    expect(client.findPublisherIri).toHaveBeenCalledTimes(1);
    expect(client.createPublisher).not.toHaveBeenCalled();
  });

  it("creates the publisher, labelled with its domain, when none exists", async () => {
    const client = {
      findPublisherIri: vi.fn().mockResolvedValue(null),
      createPublisher: vi.fn().mockResolvedValue(PUBLISHER_IRI),
    };

    const result = await createPublisherResolver(client)("kontan.co.id");

    expect(result).toEqual({ iri: PUBLISHER_IRI, created: true });
    expect(client.createPublisher).toHaveBeenCalledWith({
      registrableDomain: "kontan.co.id",
      label: "kontan.co.id",
    });
  });

  it("skips a domain that isn't registrable without calling Organon", async () => {
    const client = { findPublisherIri: vi.fn(), createPublisher: vi.fn() };

    const result = await createPublisherResolver(client)("localhost");

    expect(result).toEqual({ iri: null, created: false });
    expect(client.findPublisherIri).not.toHaveBeenCalled();
  });

  it("answers with no publisher and the error when Organon fails", async () => {
    const client = {
      findPublisherIri: vi.fn().mockResolvedValue(null),
      createPublisher: vi
        .fn()
        .mockRejectedValue(
          new Error("Organon answered 400 to a new publisher"),
        ),
    };

    const result = await createPublisherResolver(client)("kontan.co.id");

    expect(result).toEqual({
      iri: null,
      created: false,
      error: "Organon answered 400 to a new publisher",
    });
  });
});
