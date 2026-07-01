import { contentViewResponseSchema } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { buildChronicle } from "../../resources/newsletters/build-chronicle";
import { createMediapulseAgentDataApiClient } from "../../lib/mediapulse-agent-data-api-client";
import { renderAgentInsightsHtml } from "./render-agent-insights-html";
import { renderContentGenerationRunsHtml } from "./render-content-generation-runs-html";
import { renderNewsletterChronicleHtml } from "./render-newsletter-chronicle-html";
import { renderSectionCoverageHtml } from "./render-section-coverage-html";

const parseInsightsWindow = (raw: string | undefined): "24h" | "7d" | "30d" => {
  if (raw === "24h" || raw === "7d" || raw === "30d") {
    return raw;
  }
  return "7d";
};

/** Hermes content-view routes under `/v1/hermes-dashboard/content/…`. */
export const hermesDashboardContentViewRoutes = new Hono();

hermesDashboardContentViewRoutes.get("/agent-insights", async (c) => {
  const agentId = c.req.query("agentId")?.trim();
  if (!agentId) {
    return c.json({ error: "agentId is required" }, 400);
  }

  const window = parseInsightsWindow(c.req.query("window"));
  const client = await createMediapulseAgentDataApiClient();
  try {
    const payload = await client.agentInsights.get({ agentId, window });
    const body = renderAgentInsightsHtml(payload);
    return c.json(contentViewResponseSchema.parse({ body, title: "Insights" }));
  } catch {
    return c.json(
      contentViewResponseSchema.parse({
        body: "<p>No insights available.</p>",
        title: "Insights",
      }),
    );
  }
});

hermesDashboardContentViewRoutes.get("/section-coverage", async (c) => {
  const tickerId = c.req.query("tickerId")?.trim() ?? "default";
  const windowDays = Number(c.req.query("windowDays") ?? "30");
  const client = await createMediapulseAgentDataApiClient();
  const response = await client.sectionCoverageRollup.get({
    tickerId,
    windowDays: Number.isFinite(windowDays) ? windowDays : 30,
  });
  const body = renderSectionCoverageHtml(
    response.byVersion,
    tickerId,
    Number.isFinite(windowDays) ? windowDays : 30,
  );
  return c.json(
    contentViewResponseSchema.parse({ body, title: "Section coverage" }),
  );
});

hermesDashboardContentViewRoutes.get("/newsletter-chronicle", async (c) => {
  const newsletterId = c.req.query("newsletterId")?.trim();
  if (!newsletterId) {
    return c.json(
      contentViewResponseSchema.parse({
        body: "<p>newsletterId is required.</p>",
        title: "Chronicle",
      }),
    );
  }

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: newsletterId },
    select: {
      id: true,
      tickerId: true,
      subject: true,
      createdAt: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
    },
  });
  if (!newsletter) {
    return c.json(
      contentViewResponseSchema.parse({
        body: "<p>Newsletter not found.</p>",
        title: "Chronicle",
      }),
    );
  }

  const chronicle = await buildChronicle(newsletter, {
    searchQuerySet: prisma.searchQuerySet,
    dataCollectionRun: prisma.dataCollectionRun,
    dataSourceTickerSection: prisma.dataSourceTickerSection,
    contentGenerationRun: prisma.contentGenerationRun,
    deliveryRun: prisma.deliveryRun,
  });
  const body = renderNewsletterChronicleHtml(chronicle);

  return c.json(contentViewResponseSchema.parse({ body, title: "Chronicle" }));
});

hermesDashboardContentViewRoutes.get("/content-generation-runs", async (c) => {
  const client = await createMediapulseAgentDataApiClient();
  const result = await client.contentGenerationRuns.get({
    limit: 50,
  });
  const body = renderContentGenerationRunsHtml(result.data);
  return c.json(
    contentViewResponseSchema.parse({
      body,
      title: "Content generation runs",
    }),
  );
});
