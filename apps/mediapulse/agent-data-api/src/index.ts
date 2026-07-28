import { domainHealthResponseSchema } from "@hermes/domain-contract/contracts";
import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import {
  AGENT_DATA_API_LIVE_VERSIONS,
  AGENT_DATA_API_PREFIX,
  agentDataApiManifestForVersion,
  camelCaseResourceKeyToPathSegment,
} from "@workspace/agent-data-api-contract";
import { prisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";
import { logger, slimPinoLogger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

import { getAnalysis, postAnalysis } from "./routes/analysis.js";
import { postAnalysisDataSourceDelete } from "./routes/analysis-data-source-delete.js";
import {
  getContentGeneration,
  getContentGenerationNewslettersLatest,
  getContentGenerationNewslettersRecent,
  getContentGenerationBulletsRecent,
  postContentGeneration,
  postContentGenerationFetchedContent,
} from "./routes/content-generation.js";
import { postContentGenerationFetchEvents } from "./routes/fetch-event.js";
import { postContentGenerationCitations } from "./routes/newsletter-citation.js";
import { postContentGenerationSections } from "./routes/newsletter-section.js";
import { postDataCollectionExistingUrls } from "./routes/data-collection-existing-urls.js";
import {
  postDataCollectionDeadUrlsLookup,
  postDataCollectionDeadUrlsRecord,
} from "./routes/data-collection-dead-url.js";
import { getDataCollectionRecentSourceFingerprints } from "./routes/data-collection-recent-source-fingerprints.js";
import { postDataCollectionCuratedListingQuery } from "./routes/data-collection-curated-listing-query.js";
import {
  postListingDiscoveryCacheLookup,
  postListingDiscoveryCacheRecord,
} from "./routes/listing-discovery-cache.js";
import {
  postDiscoverySourceHealthRecord,
  postDiscoverySourceHealthGet,
} from "./routes/discovery-source-health.js";
import {
  getDataCollection,
  postDataCollection,
} from "./routes/data-collection.js";
import {
  getDataCollectionRun,
  postDataCollectionRun,
} from "./routes/data-collection-run.js";
import {
  getArticleAnalysisRun,
  postArticleAnalysisRun,
} from "./routes/article-analysis-run.js";
import {
  getDataCollectionFailure,
  postDataCollectionFailure,
} from "./routes/data-collection-failure.js";
import {
  getPageCollectionRun,
  postPageCollectionRun,
} from "./routes/page-collection-run.js";
import { getDeliveryRun, postDeliveryRun } from "./routes/delivery-run.js";
import { getDelivery, postDeliveryHandler } from "./routes/delivery.js";
import { postNewsletterTranslationHandler } from "./routes/newsletter-translation.js";
import {
  postDeliveryClaimHandler,
  postDeliveryClaimReleaseHandler,
} from "./routes/delivery-claim.js";
import {
  postUserRegistrationRegisterHandler,
  postUserRegistrationConfirmHandler,
  getUserRegistrationUnsubscribeHandler,
  postUserRegistrationUnsubscribeHandler,
  getUserRegistrationTickersHandler,
  postUserRegistrationWebSignupHandler,
  getUserRegistrationConfirmSubscriptionHandler,
} from "./routes/user-registration.js";
import { postNewsletterFeedbackRecordHandler } from "./routes/newsletter-feedback.js";
import { getTicker } from "./routes/ticker.js";
import { getTickerRelevanceTerms } from "./routes/ticker-relevance-terms.js";
import {
  getQueryAnalysis,
  postQueryAnalysis,
} from "./routes/query-analysis.js";
import {
  getContentGenerationRuns,
  postContentGenerationRun,
} from "./routes/content-generation-run.js";
import { postQueryAnalysisRun } from "./routes/query-analysis-run.js";
import { getSectionCoverageRollupHandler } from "./routes/section-coverage-rollup.js";
import { getAgentInsights } from "./routes/agent-insights.js";
import { postCollectionUrlOutcome } from "./routes/collection-url-outcome.js";
import {
  getPageCollectionArticles,
  postPageCollection,
  postPageCollectionExistingUrls,
  postPageCollectionResolveSources,
} from "./routes/page-collection.js";
import { createPageCollectionInsightsProvider } from "./services/insights/page-collection-insights-provider.js";
import { createContentGenerationInsightsProvider } from "./services/insights/content-generation-insights-provider.js";
import { createUserRegistrationInsightsProvider } from "./services/insights/user-registration-insights-provider.js";
import { createDataCollectionInsightsProvider } from "./services/insights/data-collection-insights-provider.js";
import { createDeliveryInsightsProvider } from "./services/insights/delivery-insights-provider.js";
import { createQueryAnalysisInsightsProvider } from "./services/insights/query-analysis-insights-provider.js";
import { createArticleAnalysisInsightsProvider } from "./services/insights/article-analysis-insights-provider.js";
import { createNewsletterFeedbackInsightsProvider } from "./services/insights/newsletter-feedback-insights-provider.js";
import { registerInsightsProvider } from "./services/agent-insights-registry.js";
import {
  registerAgentDataApiRoutes,
  type AgentDataApiHandlers,
} from "./register-agent-data-api-routes.js";

if (!env.AGENT_AUTH_API_URL) {
  throw new Error("AGENT_AUTH_API_URL is required for agent-data-api");
}

/**
 * Builds the JSON body for the public liveness route `GET /health`.
 *
 * @returns Parsed payload matching the Hermes domain health contract.
 */
const buildAgentDataApiHealthBody = () =>
  domainHealthResponseSchema.parse({
    ok: true,
    service: "agent-data-api",
  });

const app = new Hono();

app.use(slimPinoLogger({ pino: logger }));

app.get("/health", (c) => c.json(buildAgentDataApiHealthBody()));

const routeHandlers = {
  analysis: {
    get: getAnalysis,
    post: postAnalysis,
  },
  analysisDataSourceDelete: {
    post: postAnalysisDataSourceDelete,
  },
  contentGeneration: {
    get: getContentGeneration,
    post: postContentGeneration,
  },
  contentGenerationNewslettersLatest: {
    get: getContentGenerationNewslettersLatest,
  },
  contentGenerationNewslettersRecent: {
    get: getContentGenerationNewslettersRecent,
  },
  contentGenerationBulletsRecent: {
    get: getContentGenerationBulletsRecent,
  },
  contentGenerationFetchedContent: {
    post: postContentGenerationFetchedContent,
  },
  contentGenerationFetchEvents: {
    post: postContentGenerationFetchEvents,
  },
  contentGenerationCitations: {
    post: postContentGenerationCitations,
  },
  contentGenerationSections: {
    post: postContentGenerationSections,
  },
  newsletterTranslation: {
    post: postNewsletterTranslationHandler,
  },
  dataCollection: {
    get: getDataCollection,
    post: postDataCollection,
  },
  dataCollectionExistingUrls: {
    post: postDataCollectionExistingUrls,
  },
  dataCollectionDeadUrlsLookup: {
    post: postDataCollectionDeadUrlsLookup,
  },
  dataCollectionDeadUrlsRecord: {
    post: postDataCollectionDeadUrlsRecord,
  },
  dataCollectionRecentSourceFingerprints: {
    get: getDataCollectionRecentSourceFingerprints,
  },
  dataCollectionCuratedListingQuery: {
    post: postDataCollectionCuratedListingQuery,
  },
  dataCollectionRun: {
    get: getDataCollectionRun,
    post: postDataCollectionRun,
  },
  articleAnalysisRun: {
    get: getArticleAnalysisRun,
    post: postArticleAnalysisRun,
  },
  dataCollectionFailure: {
    get: getDataCollectionFailure,
    post: postDataCollectionFailure,
  },
  pageCollectionRun: {
    get: getPageCollectionRun,
    post: postPageCollectionRun,
  },
  delivery: {
    get: getDelivery,
    post: postDeliveryHandler,
  },
  deliveryClaim: {
    post: postDeliveryClaimHandler,
  },
  deliveryClaimRelease: {
    post: postDeliveryClaimReleaseHandler,
  },
  queryAnalysis: {
    get: getQueryAnalysis,
    post: postQueryAnalysis,
  },
  ticker: {
    get: getTicker,
  },
  tickerRelevanceTerms: {
    get: getTickerRelevanceTerms,
  },
  deliveryRun: {
    get: getDeliveryRun,
    post: postDeliveryRun,
  },
  newsletterFeedbackRecord: {
    post: postNewsletterFeedbackRecordHandler,
  },
  userRegistrationRegister: {
    post: postUserRegistrationRegisterHandler,
  },
  userRegistrationConfirm: {
    post: postUserRegistrationConfirmHandler,
  },
  userRegistrationUnsubscribe: {
    get: getUserRegistrationUnsubscribeHandler,
    post: postUserRegistrationUnsubscribeHandler,
  },
  userRegistrationTickers: {
    get: getUserRegistrationTickersHandler,
  },
  userRegistrationWebSignup: {
    post: postUserRegistrationWebSignupHandler,
  },
  userRegistrationConfirmSubscription: {
    get: getUserRegistrationConfirmSubscriptionHandler,
  },
  contentGenerationRuns: {
    get: getContentGenerationRuns,
    post: postContentGenerationRun,
  },
  queryAnalysisRuns: {
    post: postQueryAnalysisRun,
  },
  sectionCoverageRollup: {
    get: getSectionCoverageRollupHandler,
  },
  listingDiscoveryCacheLookup: {
    post: postListingDiscoveryCacheLookup,
  },
  listingDiscoveryCacheRecord: {
    post: postListingDiscoveryCacheRecord,
  },
  discoverySourceHealthRecord: {
    post: postDiscoverySourceHealthRecord,
  },
  discoverySourceHealthGet: {
    post: postDiscoverySourceHealthGet,
  },
  agentInsights: {
    get: getAgentInsights,
  },
  collectionUrlOutcome: {
    post: postCollectionUrlOutcome,
  },
  pageCollection: {
    post: postPageCollection,
  },
  pageCollectionExistingUrls: {
    post: postPageCollectionExistingUrls,
  },
  pageCollectionResolveSources: {
    post: postPageCollectionResolveSources,
  },
  pageCollectionArticles: {
    get: getPageCollectionArticles,
  },
} satisfies AgentDataApiHandlers;

for (const version of AGENT_DATA_API_LIVE_VERSIONS) {
  const versionApi = new Hono();
  const bearerAuthExemptPathnames = new Set([
    `${AGENT_DATA_API_PREFIX}/${version}${camelCaseResourceKeyToPathSegment("userRegistrationUnsubscribe")}`,
    `${AGENT_DATA_API_PREFIX}/${version}${camelCaseResourceKeyToPathSegment("userRegistrationTickers")}`,
    `${AGENT_DATA_API_PREFIX}/${version}${camelCaseResourceKeyToPathSegment("userRegistrationWebSignup")}`,
    `${AGENT_DATA_API_PREFIX}/${version}${camelCaseResourceKeyToPathSegment("userRegistrationConfirmSubscription")}`,
  ]);
  versionApi.use("*", async (context, next) => {
    const pathname = new URL(context.req.url).pathname;
    if (bearerAuthExemptPathnames.has(pathname)) {
      return next();
    }
    return bearerAuth({
      verifyToken: (token) =>
        verifyTokenViaAuthApi(token, env.AGENT_AUTH_API_URL!),
    })(context, next);
  });
  registerAgentDataApiRoutes(
    versionApi,
    agentDataApiManifestForVersion(version),
    routeHandlers,
  );
  app.route(`${AGENT_DATA_API_PREFIX}/${version}`, versionApi);
}

registerInsightsProvider(
  createPageCollectionInsightsProvider({
    dataCollectionRun: prisma.dataCollectionRun,
    discoverySourceHealth: prisma.discoverySourceHealth,
    dataSource: prisma.dataSource,
  }),
);
registerInsightsProvider(
  createContentGenerationInsightsProvider({
    contentGenerationRun: prisma.contentGenerationRun,
    newsletter: prisma.newsletter,
  }),
);
registerInsightsProvider(
  createUserRegistrationInsightsProvider({
    mediapulseUser: prisma.mediapulseUser,
    userTicker: prisma.userTicker,
  }),
);
registerInsightsProvider(
  createDataCollectionInsightsProvider({
    dataCollectionRun: prisma.dataCollectionRun,
    dataCollectionFailure: prisma.dataCollectionFailure,
    dataSource: prisma.dataSource,
  }),
);
registerInsightsProvider(
  createDeliveryInsightsProvider({
    deliveryRun: prisma.deliveryRun,
  }),
);
registerInsightsProvider(
  createArticleAnalysisInsightsProvider({
    articleRelevance: prisma.articleRelevance,
    articleEntity: prisma.articleEntity,
    entityRelationEvidence: prisma.entityRelationEvidence,
  }),
);

registerInsightsProvider(
  createQueryAnalysisInsightsProvider({
    searchQuerySet: prisma.searchQuerySet,
    searchQuery: prisma.searchQuery,
    searchQueryYield: prisma.searchQueryYield,
  }),
);

registerInsightsProvider(
  createNewsletterFeedbackInsightsProvider({
    newsletterFeedback: prisma.newsletterFeedback,
  }),
);

export { app };
export default {
  port: env.PORT ?? 8081,
  fetch: app.fetch,
};
