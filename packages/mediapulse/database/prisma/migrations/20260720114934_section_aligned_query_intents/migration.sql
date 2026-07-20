-- AlterEnum
BEGIN;
CREATE TYPE "SearchQueryIntent_new" AS ENUM ('industryPulse', 'competitiveLandscape', 'dealsAndMovements', 'regulatoryPolicyWatch', 'disruptorsOrTech');
ALTER TABLE "mediapulse"."search_query" ALTER COLUMN "intent" DROP DEFAULT;
ALTER TABLE "search_query" ALTER COLUMN "intent" TYPE "SearchQueryIntent_new" USING ("intent"::text::"SearchQueryIntent_new");
ALTER TYPE "SearchQueryIntent" RENAME TO "SearchQueryIntent_old";
ALTER TYPE "SearchQueryIntent_new" RENAME TO "SearchQueryIntent";
DROP TYPE "mediapulse"."SearchQueryIntent_old";
ALTER TABLE "search_query" ALTER COLUMN "intent" SET DEFAULT 'industryPulse';
COMMIT;

-- AlterTable
ALTER TABLE "search_query" ALTER COLUMN "intent" SET DEFAULT 'industryPulse';

