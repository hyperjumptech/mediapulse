/**
 * Test script: fetches emails from the shared mailbox via outlook-inbox and prints sender and subject.
 * Run from repo root: pnpm --filter @mediapulse/outlook-inbox run test:lib
 * Requires OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID (and optionally OUTLOOK_USER_ID for shared mailbox) in env (`@mediapulse/env/outlook-inbox`).
 * Note: Output contains real mailbox data (sender, subject). Do not paste or commit script output.
 */

import { createOutlookInboxClient } from "@mediapulse/outlook-inbox";
import { env } from "@mediapulse/env/outlook-inbox";

async function main(): Promise<void> {
  const { OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID } = env;
  if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET || !OUTLOOK_TENANT_ID) {
    throw new Error(
      "Set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_TENANT_ID (e.g. packages/mediapulse/outlook-inbox/.env.local from env.outlook-inbox.example).",
    );
  }

  const client = createOutlookInboxClient({
    clientId: OUTLOOK_CLIENT_ID,
    clientSecret: OUTLOOK_CLIENT_SECRET,
    tenantId: OUTLOOK_TENANT_ID,
    userId: env.OUTLOOK_USER_ID ?? "me",
  });

  const messages = await client.listMessages(
    {
      subjectContains: "New Registration",
    },
    { top: 20 },
  );

  for (const msg of messages) {
    const sender =
      msg.from?.emailAddress?.name ??
      msg.from?.emailAddress?.address ??
      "unknown";
    const subject = msg.subject ?? "(no subject)";
    console.log(`${sender}\t${subject}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
