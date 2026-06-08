"use client";

import { format } from "date-fns";

import { Badge } from "@workspace/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import type { InsightsPayload } from "@workspace/agent-data-api-contract";

import { EndpointDisplay } from "../endpoint-display";
import { JsonPretty } from "../json-pretty";
import type { AgentDetail } from "@/lib/agents";
import { InsightsTab } from "./insights/insights-tab";

const ROW_CLASS =
  "flex items-center justify-between gap-8 py-4 px-6 sm:px-7 border-b border-border/60 last:border-b-0 first:pt-6 last:pb-6";
const LABEL_CLASS =
  "shrink-0 text-xs text-muted-foreground font-medium uppercase tracking-wide";
const VALUE_CLASS =
  "min-w-0 flex-1 text-sm font-medium text-foreground text-right";

type AgentDetailsContentProps = {
  /** Agent from getAgentById (registry row with domain integration id). */
  agent: AgentDetail;
  insightsPayload?: InsightsPayload | null;
  insightsWindow?: "24h" | "7d" | "30d";
};

/**
 * Renders agent details in a tabbed layout: General (details including domain integration id, endpoint), Input schema (pretty JSON), Config schema (pretty JSON), and Insights.
 */
export const AgentDetailsContent = ({
  agent,
  insightsPayload,
  insightsWindow,
}: AgentDetailsContentProps) => {
  const showInsights = insightsPayload != null;
  const tabColsClass = showInsights ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Agent details: {agent.agentId}@{agent.agentVersion}
      </h1>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid w-full ${tabColsClass}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="input-schema">Input schema</TabsTrigger>
          <TabsTrigger value="config-schema">Config schema</TabsTrigger>
          {showInsights && (
            <TabsTrigger value="insights">Insights</TabsTrigger>
          )}
        </TabsList>
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
        <TabsContent value="input-schema" className="pt-6">
          <JsonPretty value={agent.inputSchema} title="Input schema" />
        </TabsContent>
        <TabsContent value="config-schema" className="pt-6">
          <JsonPretty value={agent.configSchema} title="Config schema" />
        </TabsContent>
        {showInsights && (
          <TabsContent value="insights" className="pt-6">
            <InsightsTab
              payload={insightsPayload}
              agentId={agent.agentId}
              window={insightsWindow ?? "7d"}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
