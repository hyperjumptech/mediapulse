/**
 * Test script: fetches emails from the shared mailbox via outlook-inbox and prints sender and subject.
 * Run from repo root (pass Azure app credentials as flags, not env):
 * `pnpm --filter @mediapulse/outlook-inbox run test:lib -- --client-id=… --client-secret=… --tenant-id=… [--user-id=…]`
 * Note: Output contains real mailbox data (sender, subject). Do not paste or commit script output.
 */

import { createOutlookInboxClient } from "@mediapulse/outlook-inbox";

import { parseOutlookTestLibCli } from "./parse-outlook-test-lib-cli.js";

async function main(): Promise<void> {
  const { clientId, clientSecret, tenantId, userId } = parseOutlookTestLibCli(
    process.argv.slice(2),
  );

  const client = createOutlookInboxClient({
    clientId,
    clientSecret,
    tenantId,
    userId,
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
