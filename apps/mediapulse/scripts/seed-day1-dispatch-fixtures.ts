import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

export const DAY1_FIXTURE_PREFIX = "day1-demo-";

type Day1FixtureKind = "bootstrap" | "latest_issue" | "none";
type Day1FixtureStatus = "dispatching" | "fired" | "failed" | "skipped";

export type Day1DispatchFixture = {
  suffix: string;
  email: string;
  language: "en" | "id";
  kind: Day1FixtureKind;
  status: Day1FixtureStatus;
  reason: string | null;
  hermesExecutionId: string | null;
  error: string | null;
  minutesAgo: number;
};

export const DAY1_DISPATCH_FIXTURES: Day1DispatchFixture[] = [
  {
    suffix: "1",
    email: "first.reader@example.com",
    language: "en",
    kind: "bootstrap",
    status: "fired",
    reason: null,
    hermesExecutionId: `${DAY1_FIXTURE_PREFIX}execution-1`,
    error: null,
    minutesAgo: 5,
  },
  {
    suffix: "2",
    email: "second.reader@example.com",
    language: "en",
    kind: "none",
    status: "skipped",
    reason: "bootstrap_in_flight",
    hermesExecutionId: null,
    error: null,
    minutesAgo: 3,
  },
  {
    suffix: "3",
    email: "pembaca@example.com",
    language: "id",
    kind: "none",
    status: "skipped",
    reason: "missing_translation",
    hermesExecutionId: null,
    error: null,
    minutesAgo: 90,
  },
  {
    suffix: "4",
    email: "latest.reader@example.com",
    language: "en",
    kind: "latest_issue",
    status: "fired",
    reason: null,
    hermesExecutionId: `${DAY1_FIXTURE_PREFIX}execution-4`,
    error: null,
    minutesAgo: 240,
  },
  {
    suffix: "5",
    email: "unlucky.reader@example.com",
    language: "en",
    kind: "bootstrap",
    status: "failed",
    reason: null,
    hermesExecutionId: null,
    error: 'Hermes trigger answered 401: {"error":"Unauthorized"}',
    minutesAgo: 600,
  },
];

type FixtureDb = Pick<
  import("@mediapulse/database").PrismaClient,
  "ticker" | "mediapulseUser" | "userTicker" | "day1NewsletterDispatch"
>;

export const removeDay1DispatchFixtures = async (
  db: FixtureDb,
): Promise<void> => {
  const byPrefix = { id: { startsWith: DAY1_FIXTURE_PREFIX } };
  await db.day1NewsletterDispatch.deleteMany({ where: byPrefix });
  await db.userTicker.deleteMany({ where: byPrefix });
  await db.mediapulseUser.deleteMany({ where: byPrefix });
};

export const seedDay1DispatchFixtures = async (
  db: FixtureDb,
  now: Date,
): Promise<number> => {
  const tickers = await db.ticker.findMany({
    orderBy: { symbol: "asc" },
    take: 3,
    select: { id: true },
  });
  if (tickers.length === 0) {
    throw new Error(
      "The Mediapulse database has no tickers to attach fixtures to.",
    );
  }
  for (const [index, fixture] of DAY1_DISPATCH_FIXTURES.entries()) {
    const ticker = tickers[index % tickers.length];
    if (!ticker) continue;
    const userId = `${DAY1_FIXTURE_PREFIX}user-${fixture.suffix}`;
    const userTickerId = `${DAY1_FIXTURE_PREFIX}subscription-${fixture.suffix}`;
    const createdAt = new Date(now.getTime() - fixture.minutesAgo * 60_000);
    await db.mediapulseUser.create({
      data: { id: userId, email: fixture.email, name: fixture.email },
    });
    await db.userTicker.create({
      data: {
        id: userTickerId,
        userId,
        tickerId: ticker.id,
        language: fixture.language,
        registrationConfirmedAt: createdAt,
      },
    });
    await db.day1NewsletterDispatch.create({
      data: {
        id: `${DAY1_FIXTURE_PREFIX}dispatch-${fixture.suffix}`,
        userTickerId,
        tickerId: ticker.id,
        language: fixture.language,
        kind: fixture.kind,
        status: fixture.status,
        reason: fixture.reason,
        hermesExecutionId: fixture.hermesExecutionId,
        error: fixture.error,
        createdAt,
      },
    });
  }

  return DAY1_DISPATCH_FIXTURES.length;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async (): Promise<void> => {
  config({ path: path.resolve(__dirname, ".env.local") });
  const { prisma } = await import("@mediapulse/database");
  await removeDay1DispatchFixtures(prisma);
  if (process.argv.includes("--remove")) {
    console.log("Removed the day 1 dispatch fixtures.");

    return;
  }
  const seeded = await seedDay1DispatchFixtures(prisma, new Date());
  console.log(
    `Seeded ${seeded} day 1 dispatch fixtures. Open /dashboard/<integrationId>/day1-dispatches in Hermes. Remove them with --remove.`,
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed the day 1 dispatch fixtures", error);
      process.exit(1);
    });
}
