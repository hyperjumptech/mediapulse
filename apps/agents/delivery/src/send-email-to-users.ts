import { env } from "@workspace/env/agents-delivery";
import { createEmailSender, createResendTransport, createSmtpTransport } from "@workspace/email-send";
import * as React from "react";
import { NewsletterTemplate } from "./emails/newsletter-template.js";

// Initialize the email sender conditionally based on the environment
export const emailSender = createEmailSender({
  from: env.NODE_ENV === "development" ? "Mailtrap Test <noreply@example.com>" : env.RESEND_SENDER,
  transport: env.NODE_ENV === "development"
    ? createSmtpTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        secure: false, // Mailtrap doesn't strictly require TLS for the basic sandbox
        auth: {
          user: process.env.EMAIL_USER || env.EMAIL_USER || "",
          pass: process.env.EMAIL_PASS || env.EMAIL_PASS || "",
        },
      })
    : createResendTransport({ apiKey: env.RESEND_API_KEY }),
});

export async function sendEmailToUsers(
  newsletter: { subject: string; content: string },
  users: { email: string }[],
) {
  // Validate credentials in development
  if (env.NODE_ENV === "development") {
    const user = process.env.EMAIL_USER || env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS || env.EMAIL_PASS;
    if (!user || !pass) {
        throw new Error("Missing Mailtrap credentials. Please configure EMAIL_USER and EMAIL_PASS in your .env");
    }
  }

  for (const user of users) {
    const reactElement = React.createElement(NewsletterTemplate, {
       subject: newsletter.subject,
       content: newsletter.content
    });

    await emailSender.send({
      to: user.email,
      subject: newsletter.subject,
      template: "newsletter" as any, // Using the scaffolded key to satisfy the type, actually overridden by reactElement
      data: null,
      reactElement: reactElement,
    });

    // Keeping the original artificial delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
