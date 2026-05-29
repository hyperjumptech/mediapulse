import { z } from "zod";

export const agentActivityStatusSchema = z.enum(["processing", "completed"]);

export const postAgentActivityBodySchema = z.object({
  jobId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  status: agentActivityStatusSchema,
});

export const postAgentActivityResponseSchema = z.object({
  id: z.string().uuid(),
});

export const getAgentActivityQuerySchema = z.object({
  jobId: z.string().uuid(),
});

export const agentActivityListItemSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: agentActivityStatusSchema,
  createdAt: z.string().datetime(),
});

export const getAgentActivityResponseSchema = z.object({
  data: z.array(agentActivityListItemSchema),
});

export type AgentActivityStatus = z.infer<typeof agentActivityStatusSchema>;
export type PostAgentActivityBody = z.infer<typeof postAgentActivityBodySchema>;
export type PostAgentActivityResponse = z.infer<
  typeof postAgentActivityResponseSchema
>;
export type GetAgentActivityQuery = z.infer<typeof getAgentActivityQuerySchema>;
export type AgentActivityListItem = z.infer<typeof agentActivityListItemSchema>;
export type GetAgentActivityResponse = z.infer<
  typeof getAgentActivityResponseSchema
>;
