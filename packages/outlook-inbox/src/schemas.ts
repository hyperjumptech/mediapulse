import { z } from "zod";

/** Zod schema for Graph API email address. */
const emailAddressSchema = z.object({
  address: z.string().optional(),
  name: z.string().optional(),
});

/** Zod schema for Graph API message body. */
const messageBodySchema = z.object({
  content: z.string().optional(),
  contentType: z.string().optional(),
});

/** Zod schema for Graph API message (minimal shape for list/move). */
export const graphMessageSchema = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  receivedDateTime: z.string(),
  isRead: z.boolean(),
  body: messageBodySchema.optional(),
  from: z.object({ emailAddress: emailAddressSchema.optional() }).optional(),
  toRecipients: z
    .array(z.object({ emailAddress: emailAddressSchema.optional() }))
    .optional(),
});

/** Zod schema for Graph API list messages response. */
export const listMessagesResponseSchema = z.object({
  value: z.array(graphMessageSchema).optional(),
  "@odata.nextLink": z.string().optional(),
});

export type GraphMessage = z.infer<typeof graphMessageSchema>;
export type ListMessagesResponse = z.infer<typeof listMessagesResponseSchema>;
