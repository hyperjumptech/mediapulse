"use client";

import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Badge } from "@workspace/ui/components/badge";

import { EndpointDisplay } from "./endpoint-display";
import { JsonSchemaSummary } from "./json-schema-summary";
import type { AgentsPageResult } from "@/lib/agents";

type AgentRow = AgentsPageResult["agents"][number];

const ROW_CLASS =
  "flex items-center justify-between gap-8 py-4 px-6 sm:px-7 border-b border-border/60 last:border-b-0 first:pt-6 last:pb-6";
const LABEL_CLASS =
  "shrink-0 text-xs text-muted-foreground font-medium uppercase tracking-wide";
const VALUE_CLASS =
  "min-w-0 flex-1 text-sm font-medium text-foreground text-right";

type AgentDetailsModalProps = {
  agent: AgentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Read-only modal that shows agent details: ID, version, description, active, created,
 * endpoint (key-value), input schema summary, and config schema summary.
 * Agents are self-registered; admins cannot edit.
 */
export const AgentDetailsModal = ({
  agent,
  open,
  onOpenChange,
}: AgentDetailsModalProps) => {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto px-6 sm:px-8 pb-8">
        <DialogHeader className="px-0">
          <DialogTitle>
            Agent details: {agent.agentId}@{agent.agentVersion}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-8 pt-6">
          <section className="min-h-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Details
            </h3>
            <div className="rounded-lg bg-muted/25 border border-border/50 overflow-hidden">
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Agent ID</span>
                <span className={VALUE_CLASS}>{agent.agentId}</span>
              </div>
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Version</span>
                <span className={VALUE_CLASS}>{agent.agentVersion}</span>
              </div>
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Description</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground normal-case font-normal text-right">
                  {agent.description ?? "—"}
                </span>
              </div>
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Active</span>
                <span className="min-w-0 flex-1 flex justify-end">
                  <Badge
                    variant={agent.isActive ? "default" : "secondary"}
                    className="font-normal"
                  >
                    {agent.isActive ? "Yes" : "No"}
                  </Badge>
                </span>
              </div>
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Created</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground normal-case font-normal text-right">
                  {format(agent.createdAt, "LLL d, yyyy")}
                </span>
              </div>
            </div>
          </section>

          <section className="min-h-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Endpoint
            </h3>
            <div className="rounded-lg bg-muted/25 border border-border/50 overflow-hidden">
              <EndpointDisplay endpoint={agent.endpoint} />
            </div>
          </section>

          <section className="min-h-0">
            <JsonSchemaSummary
              schema={agent.inputSchema}
              title="Input schema"
            />
          </section>

          <section className="min-h-0">
            <JsonSchemaSummary
              schema={agent.configSchema}
              title="Config schema"
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
