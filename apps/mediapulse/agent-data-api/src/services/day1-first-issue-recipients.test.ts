/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findDay1FirstIssueRecipients,
  type Day1FirstIssueRecipientsDb,
} from "./day1-first-issue-recipients.js";

type DispatchRow = { userTickerId: string; userTicker: { userId: string } };

const dispatchRow = (userTickerId: string, userId: string): DispatchRow => ({
  userTickerId,
  userTicker: { userId },
});

const createDb = ({
  dispatches = [dispatchRow("user-ticker-1", "user-1")],
  earlierDeliveryCountByUserId = {},
}: {
  dispatches?: DispatchRow[];
  earlierDeliveryCountByUserId?: Record<string, number>;
} = {}) => {
  const findMany = vi.fn().mockResolvedValue(dispatches);
  const count = vi.fn(
    async ({ where }: { where: { userTicker: { userId: string } } }) =>
      earlierDeliveryCountByUserId[where.userTicker.userId] ?? 0,
  );
  const db = {
    day1NewsletterDispatch: { findMany },
    newsletterDeliveryCheckpoint: { count },
  } as unknown as Day1FirstIssueRecipientsDb;

  return { db, findMany, count };
};

const RUN = {
  tickerId: "ticker-1",
  scheduleExecutionId: "trigger-execution-1",
};

describe("findDay1FirstIssueRecipients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the subscriber whose dispatch started this run", async () => {
    const { db, findMany, count } = createDb();

    const recipients = await findDay1FirstIssueRecipients(db, RUN);

    expect(recipients).toEqual(["user-ticker-1"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { hermesExecutionId: "trigger-execution-1", tickerId: "ticker-1" },
      select: {
        userTickerId: true,
        userTicker: { select: { userId: true } },
      },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        resendEmailId: { not: null },
        userTicker: { userId: "user-1", tickerId: "ticker-1" },
      },
    });
  });

  it("returns every new subscriber this run delivers to", async () => {
    const { db } = createDb({
      dispatches: [
        dispatchRow("user-ticker-1", "user-1"),
        dispatchRow("user-ticker-2", "user-2"),
      ],
    });

    const recipients = await findDay1FirstIssueRecipients(db, RUN);

    expect(recipients).toEqual(["user-ticker-1", "user-ticker-2"]);
  });

  it("returns each subscriber once when several dispatches point at the same run", async () => {
    const { db } = createDb({
      dispatches: [
        dispatchRow("user-ticker-1", "user-1"),
        dispatchRow("user-ticker-1", "user-1"),
      ],
    });

    const recipients = await findDay1FirstIssueRecipients(db, RUN);

    expect(recipients).toEqual(["user-ticker-1"]);
  });

  it("returns nothing without a schedule execution id", async () => {
    const { db, findMany } = createDb();

    const recipients = await findDay1FirstIssueRecipients(db, {
      ...RUN,
      scheduleExecutionId: undefined,
    });

    expect(recipients).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns nothing when no dispatch points at this run", async () => {
    const { db, count } = createDb({ dispatches: [] });

    const recipients = await findDay1FirstIssueRecipients(db, {
      ...RUN,
      scheduleExecutionId: "nightly-schedule-execution",
    });

    expect(recipients).toEqual([]);
    expect(count).not.toHaveBeenCalled();
  });

  it("leaves out a returning subscriber who already received an issue for this ticker", async () => {
    const { db } = createDb({
      dispatches: [
        dispatchRow("user-ticker-1", "user-1"),
        dispatchRow("user-ticker-2", "user-2"),
      ],
      earlierDeliveryCountByUserId: { "user-1": 3 },
    });

    const recipients = await findDay1FirstIssueRecipients(db, RUN);

    expect(recipients).toEqual(["user-ticker-2"]);
  });
});
