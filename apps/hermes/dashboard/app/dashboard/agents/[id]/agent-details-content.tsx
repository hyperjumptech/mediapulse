"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";

import { Badge } from "@workspace/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { EndpointDisplay } from "../endpoint-display";
import { JsonPretty } from "../json-pretty";
import type { AgentDetail } from "@/lib/agents";

const ROW_CLASS =
  "flex items-center justify-between gap-8 py-4 px-6 sm:px-7 border-b border-border/60 last:border-b-0 first:pt-6 last:pb-6";
const LABEL_CLASS =
  "shrink-0 text-xs text-muted-foreground font-medium uppercase tracking-wide";
const VALUE_CLASS =
  "min-w-0 flex-1 text-sm font-medium text-foreground text-right";

type AgentDetailsContentProps = {
  /** Agent from getAgentById (registry row with domain integration id). */
  agent: AgentDetail;
  /** Optional insights panel rendered by a registered dashboard extension. */
  insightsPanel?: ReactNode;
};

/**
 * Renders agent details in a tabbed layout: Insights (when extension provides data), Schema (input + config), and Info (details).
 */
export const AgentDetailsContent = ({
  agent,
  insightsPanel,
}: AgentDetailsContentProps) => {
  const showInsights = insightsPanel != null;
  const tabColsClass = showInsights ? "grid-cols-3" : "grid-cols-2";
  const defaultTab = showInsights ? "insights" : "schema";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Agent details: {agent.agentId}@{agent.agentVersion}
      </h1>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${tabColsClass}`}>
          {showInsights && <TabsTrigger value="insights">Insights</TabsTrigger>}
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="general">Info</TabsTrigger>
        </TabsList>
        {showInsights && (
          <TabsContent value="insights" className="pt-6">
            {insightsPanel}
          </TabsContent>
        )}
        <TabsContent value="schema" className="space-y-8 pt-6">
          <JsonPretty value={agent.inputSchema} title="Input schema" />
          <JsonPretty value={agent.configSchema} title="Config schema" />
        </TabsContent>
        <TabsContent value="general" className="space-y-8 pt-6">
          <section className="min-h-0">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Details
            </h2>
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
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Last updated</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground normal-case font-normal text-right">
                  {format(agent.updatedAt, "LLL d, yyyy")}
                </span>
              </div>
              <div className={ROW_CLASS}>
                <span className={LABEL_CLASS}>Domain integration id</span>
                <span
                  className={`${VALUE_CLASS} font-mono text-xs sm:text-sm break-all`}
                >
                  {agent.domainIntegration.integrationId}
                </span>
              </div>
            </div>
          </section>
          <section className="min-h-0">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Endpoint
            </h2>
            <div className="rounded-lg bg-muted/25 border border-border/50 overflow-hidden">
              <EndpointDisplay endpoint={agent.endpoint} />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};
