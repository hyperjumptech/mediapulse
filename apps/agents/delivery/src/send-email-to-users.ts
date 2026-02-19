import { env } from "@workspace/env/agents-delivery";
import { prisma } from "@workspace/database";

import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmailToUsers(
  newsletter: { subject: string; content: string },
  users?: { email: string }[],
) {
  const recipients = users ?? (await prisma.user.findMany());

  for (const user of recipients) {
    await resend.emails.send({
      from: env.RESEND_SENDER,
      to: user.email,
      subject: newsletter.subject,
      text: newsletter.content,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
