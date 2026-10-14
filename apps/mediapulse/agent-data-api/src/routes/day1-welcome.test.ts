/** @vitest-environment node */
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));
vi.mock("../services/day1-welcome.js", () => ({ getDay1Welcome: vi.fn() }));
vi.mock("../services/day1-welcome-claim.js", () => ({
  claimDay1Welcome: vi.fn(),
  releaseDay1WelcomeClaim: vi.fn(),
  recordDay1WelcomeSent: vi.fn(),
}));

import {
  claimDay1Welcome,
  recordDay1WelcomeSent,
  releaseDay1WelcomeClaim,
} from "../services/day1-welcome-claim.js";
import { getDay1Welcome } from "../services/day1-welcome.js";
import {
  getDay1WelcomeHandler,
  postDay1WelcomeClaimHandler,
  postDay1WelcomeClaimReleaseHandler,
  postDay1WelcomeHandler,
} from "./day1-welcome.js";

const DISPATCH_ID = "11111111-1111-4111-8111-111111111111";

const createApp = () => {
  const app = new Hono();
  app.get("/day1-welcome", getDay1WelcomeHandler);
  app.post("/day1-welcome", postDay1WelcomeHandler);
  app.post("/day1-welcome-claim", postDay1WelcomeClaimHandler);
  app.post("/day1-welcome-claim-release", postDay1WelcomeClaimReleaseHandler);

  return app;
};

const postJson = (app: Hono, path: string, body: unknown) =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("day1 welcome routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the welcome payload for a dispatch", async () => {
    vi.mocked(getDay1Welcome).mockResolvedValue({ welcome: null });

    const response = await createApp().request(
      `http://localhost/day1-welcome?dispatchId=${DISPATCH_ID}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ welcome: null });
    expect(getDay1Welcome).toHaveBeenCalledWith(expect.anything(), {
      dispatchId: DISPATCH_ID,
    });
  });

  it("rejects a dispatch id that is not a uuid", async () => {
    const response = await createApp().request(
      "http://localhost/day1-welcome?dispatchId=nope",
    );

    expect(response.status).toBe(400);
    expect(getDay1Welcome).not.toHaveBeenCalled();
  });

  it("records the send", async () => {
    const response = await postJson(createApp(), "/day1-welcome", {
      dispatchId: DISPATCH_ID,
      resendEmailId: "re_1",
    });

    expect(response.status).toBe(200);
    expect(recordDay1WelcomeSent).toHaveBeenCalledWith(expect.anything(), {
      dispatchId: DISPATCH_ID,
      resendEmailId: "re_1",
    });
  });

  it("returns whether the claim was taken", async () => {
    vi.mocked(claimDay1Welcome).mockResolvedValue({ claimed: false });

    const response = await postJson(createApp(), "/day1-welcome-claim", {
      dispatchId: DISPATCH_ID,
    });

    expect(await response.json()).toEqual({ claimed: false });
  });

  it("returns whether a claim was released", async () => {
    vi.mocked(releaseDay1WelcomeClaim).mockResolvedValue({ released: true });

    const response = await postJson(
      createApp(),
      "/day1-welcome-claim-release",
      { dispatchId: DISPATCH_ID },
    );

    expect(await response.json()).toEqual({ released: true });
  });
});
