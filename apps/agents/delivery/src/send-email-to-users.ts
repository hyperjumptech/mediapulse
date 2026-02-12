import { env } from "@workspace/env/agents-delivery";
import { prisma } from "@workspace/prisma";

import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmailToUsers(newsletter: {
  subject: string;
  content: string;
}) {
  const users = await prisma.user.findMany();

  await Promise.all(
    users.map((user) =>
      resend.emails.send({
        from: env.RESEND_SENDER,
        to: user.email,
        subject: newsletter.subject,
        text: newsletter.content,
      }),
    ),
  );
}
