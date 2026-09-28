"use client";

import { CircleAlert } from "lucide-react";

import type {
  ContentViewResponse,
  DashboardView,
} from "@hermes/domain-contract";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { CopyableId } from "@/components/copyable-id";
import { DomainContentView } from "@/components/domain-content-view";
import { PageHeader } from "@/components/page-header";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import type { AgentDetail } from "@/lib/agents";

import { EndpointDisplay, endpointToRecord } from "../endpoint-display";
import { JsonPretty } from "../json-pretty";
import { AgentUnregisterButton } from "./agent-unregister-button";

type AgentTabContent = {
  view: DashboardView;
  content: ContentViewResponse;
};

type DomainAgentTabContent = AgentTabContent & {
  view: Extract<DashboardView, { kind: "markdown" | "html" | "text" }>;
};

type AgentDetailsContentProps = {
  agent: AgentDetail;
  agentTabContents?: AgentTabContent[];
  agentTabContentsError?: string;
};

const isDomainAgentTabContent = (
  entry: AgentTabContent,
): entry is DomainAgentTabContent =>
  entry.view.kind === "markdown" ||
  entry.view.kind === "html" ||
  entry.view.kind === "text";

const readEndpointUrl = (endpoint: unknown): string | null => {
  const endpointUrl = endpointToRecord(endpoint)?.url;

  return typeof endpointUrl === "string" && endpointUrl.trim() !== ""
    ? endpointUrl
    : null;
};

const TAB_TRIGGER_CLASS_NAME = "flex-none px-3";

export const AgentDetailsContent = ({
  agent,
  agentTabContents = [],
  agentTabContentsError,
}: AgentDetailsContentProps) => {
  const domainTabs = agentTabContents.filter(isDomainAgentTabContent);
  const defaultTab = domainTabs[0]?.view.id ?? "schema";
  const agentLabel = `${agent.agentId}@${agent.agentVersion}`;
  const activeStatus = agent.isActive ? "active" : "inactive";
  const endpointUrl = readEndpointUrl(agent.endpoint);
  const description = agent.description ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <BreadcrumbEntityLabel segment={agent.id} label={agentLabel} />
      <PageHeader
        title={<span className="font-mono tracking-normal">{agentLabel}</span>}
        badges={<StatusBadge status={activeStatus} />}
        description={description}
        actions={
          <AgentUnregisterButton agentId={agent.id} agentLabel={agentLabel} />
        }
      />
      <SummaryGrid>
        <SummaryItem label="Integration">
          <span className="font-mono text-xs">
            {agent.domainIntegration.integrationId}
          </span>
        </SummaryItem>
        <SummaryItem label="Endpoint URL" wide>
          {endpointUrl ? (
            <CopyableId value={endpointUrl} label="Copy endpoint URL" />
          ) : (
            <span className="text-muted-foreground">No endpoint</span>
          )}
        </SummaryItem>
        <SummaryItem label="Created">
          <DateTime value={agent.createdAt} style="datetime" />
        </SummaryItem>
        <SummaryItem label="Updated">
          <DateTime value={agent.updatedAt} style="datetime" />
        </SummaryItem>
      </SummaryGrid>
      {agentTabContentsError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Integration tabs unavailable</AlertTitle>
          <AlertDescription>{agentTabContentsError}</AlertDescription>
        </Alert>
      ) : null}
      <Tabs defaultValue={defaultTab} className="w-full gap-4">
        <TabsList variant="line" className="w-full justify-start border-b">
          {domainTabs.map(({ view }) => (
            <TabsTrigger
              key={view.id}
              value={view.id}
              className={TAB_TRIGGER_CLASS_NAME}
            >
              {view.tabLabel ?? view.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="schema" className={TAB_TRIGGER_CLASS_NAME}>
            Schema
          </TabsTrigger>
          <TabsTrigger value="general" className={TAB_TRIGGER_CLASS_NAME}>
            Info
          </TabsTrigger>
        </TabsList>
        {domainTabs.map(({ view, content }) => (
          <TabsContent key={view.id} value={view.id}>
            <DomainContentView
              kind={view.kind}
              body={content.body}
              title={content.title}
            />
          </TabsContent>
        ))}
        <TabsContent value="schema" className="grid gap-6 lg:grid-cols-2">
          <JsonPretty value={agent.inputSchema} title="Input schema" />
          <JsonPretty value={agent.configSchema} title="Config schema" />
        </TabsContent>
        <TabsContent value="general" className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <SummaryGrid className="lg:grid-cols-3">
              <SummaryItem label="Agent ID">
                <span className="font-mono">{agent.agentId}</span>
              </SummaryItem>
              <SummaryItem label="Version">
                <span className="font-mono">{agent.agentVersion}</span>
              </SummaryItem>
              <SummaryItem label="Registry ID">
                <CopyableId value={agent.id} label="Copy registry ID" />
              </SummaryItem>
            </SummaryGrid>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Endpoint</h2>
            <div className="overflow-hidden rounded-lg border bg-card">
              <EndpointDisplay endpoint={agent.endpoint} />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};
