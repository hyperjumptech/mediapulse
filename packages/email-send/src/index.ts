import { render } from "@react-email/render";
import * as nodemailer from "nodemailer";
import { Resend } from "resend";
import { TemplateMap, templates } from "@workspace/email-templates";
import React from "react";

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailResult>;
}

export const createResendTransport = (config: { apiKey: string }): EmailTransport => {
  const resend = new Resend(config.apiKey);
  return {
    async send(message) {
      const { error, data } = await resend.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      if (error) {
         return { success: false };
      }
      return { success: true, messageId: data?.id };
    },
  };
};

export const createSmtpTransport = (config: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }): EmailTransport => {
  const transporter = nodemailer.createTransport(config);
  return {
    async send(message) {
      const info = await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      return { success: true, messageId: info.messageId };
    },
  };
};

export interface EmailSenderConfig {
  from: string;
  transport: EmailTransport;
}

export const createEmailSender = (config: EmailSenderConfig) => {
  return {
    async send<K extends keyof TemplateMap>(params: {
      to: string;
      subject: string;
      template: K;
      data: TemplateMap[K];
      /** Allow passing an external react element instead of relying on the registry, to support the local newsletter template */
      reactElement?: React.ReactElement;
    }): Promise<EmailResult> {
      let html: string;

      if (params.reactElement) {
         html = await render(params.reactElement);
      } else {
         const Component = templates[params.template];
         if (!Component) {
            throw new Error(`Template ${String(params.template)} not found in registry`);
         }
         html = await render(React.createElement(Component as any, params.data));
      }

      return config.transport.send({
        from: config.from,
        to: params.to,
        subject: params.subject,
        html,
      });
    },
  };
};
