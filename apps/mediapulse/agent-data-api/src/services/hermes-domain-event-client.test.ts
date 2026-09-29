/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { createHermesDomainEventClient } from "./hermes-domain-event-client.js";

const sendArgs = {
  event: "day1.full-chain",
  params: { tickerId: "ticker-1" },
  requestId: "day1:ut-1:dispatch-1",
};

const buildClient = (fetchImpl: typeof fetch) =>
  createHermesDomainEventClient({
    baseUrl: "https://hermes.example/",
    apiKey: "integration-key",
    timeoutMs: 5_000,
    fetchImpl,
  });

describe("createHermesDomainEventClient", () => {
  it("posts the event with the integration key and returns the execution ids", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          executions: [
            {
              triggerId: "00000000-0000-4000-8000-000000000001",
              executionId: "00000000-0000-4000-8000-000000000002",
            },
          ],
        }),
        { status: 202 },
      ),
    );

    const result = await buildClient(fetchImpl)(sendArgs);

    expect(result).toEqual({
      executionIds: ["00000000-0000-4000-8000-000000000002"],
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hermes.example/api/domain-integrations/events");
    expect(init.headers).toEqual({
      authorization: "Bearer integration-key",
      "content-type": "application/json",
      "x-request-id": "day1:ut-1:dispatch-1",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      event: "day1.full-chain",
      params: { tickerId: "ticker-1" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns no execution ids when nothing listens to the event", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ executions: [] }), { status: 202 }),
      );

    await expect(buildClient(fetchImpl)(sendArgs)).resolves.toEqual({
      executionIds: [],
    });
  });

  it("throws with the status and body when Hermes refuses the event", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"message":"Unauthorized"}', { status: 401 }),
      );

    await expect(buildClient(fetchImpl)(sendArgs)).rejects.toThrow(
      'Hermes answered 401 to event day1.full-chain: {"message":"Unauthorized"}',
    );
  });
});
