/**
 * Unified PR change detection for GitHub Actions workflows.
 * Classifies diffs to skip unrelated CI jobs (reviews, Prisma drift, Docker builds).
 */

/** @typedef {'docs_only' | 'ci_infra' | 'affected' | 'full'} ChangeScope */

/** @typedef {'pull_request' | 'push' | 'workflow_dispatch' | string} CiEventName */

/** @typedef {'all' | 'app' | 'agent'} DeployWorkflow */

/**
 * @typedef {object} ServiceDeployConfig
 * @property {string} service
 * @property {string} dockerfile
 * @property {string} image
 * @property {string} webhook_secret
 */

/** All deployable Docker services (apps + agents). */
export const ALL_DOCKER_SERVICES = [
  "user-registration",
  "domain-api",
  "agent-data-api",
  "agent-auth-api",
  "agent-registry-api",
  "hermes",
  "hermes-worker",
  "data-collection",
  "content-generation",
  "delivery",
  "ticker-echo",
  "article-analysis",
  "query-analysis",
  "agent-user-registration",
  "agent-newsletter-feedback",
  "page-collection",
  "knowledge-ingestion",
];

/** App deploy workflow services. */
export const APP_DEPLOY_SERVICES = [
  "agent-auth-api",
  "agent-data-api",
  "domain-api",
  "agent-registry-api",
  "user-registration",
  "hermes",
  "hermes-worker",
];

/** Agent deploy workflow services. */
export const AGENT_DEPLOY_SERVICES = [
  "data-collection",
  "content-generation",
  "article-analysis",
  "query-analysis",
  "delivery",
  "ticker-echo",
  "agent-user-registration",
  "agent-newsletter-feedback",
  "page-collection",
  "knowledge-ingestion",
];

/** @type {Record<string, ServiceDeployConfig>} */
export const SERVICE_DEPLOY_CONFIG = {
  "agent-auth-api": {
    service: "agent-auth-api",
    dockerfile: "apps/hermes/agent-auth-api/Dockerfile",
    image: "app-agent-auth-api",
    webhook_secret: "COOLIFY_WEBHOOK_APP_AGENT_AUTH_API",
  },
  "agent-data-api": {
    service: "agent-data-api",
    dockerfile: "apps/mediapulse/agent-data-api/Dockerfile",
    image: "app-agent-data-api",
    webhook_secret: "COOLIFY_WEBHOOK_APP_AGENT_DATA_API",
  },
  "domain-api": {
    service: "domain-api",
    dockerfile: "apps/mediapulse/domain-api/Dockerfile",
    image: "app-domain-api",
    webhook_secret: "COOLIFY_WEBHOOK_APP_DOMAIN_API",
  },
  "agent-registry-api": {
    service: "agent-registry-api",
    dockerfile: "apps/hermes/agent-registry-api/Dockerfile",
    image: "app-agent-registry-api",
    webhook_secret: "COOLIFY_WEBHOOK_APP_AGENT_REGISTRY_API",
  },
  "user-registration": {
    service: "user-registration",
    dockerfile: "apps/mediapulse/user-registration/Dockerfile",
    image: "app-user-registration",
    webhook_secret: "COOLIFY_WEBHOOK_APP_USER_REGISTRATION",
  },
  hermes: {
    service: "hermes",
    dockerfile: "apps/hermes/dashboard/Dockerfile",
    image: "app-hermes",
    webhook_secret: "COOLIFY_WEBHOOK_APP_HERMES",
  },
  "hermes-worker": {
    service: "hermes-worker",
    dockerfile: "apps/hermes/worker/Dockerfile",
    image: "app-hermes-worker",
    webhook_secret: "COOLIFY_WEBHOOK_APP_HERMES_WORKER",
  },
  "data-collection": {
    service: "data-collection",
    dockerfile: "apps/mediapulse/agents/data-collection/Dockerfile",
    image: "agent-data-collection",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_DATA_COLLECTION",
  },
  "content-generation": {
    service: "content-generation",
    dockerfile: "apps/mediapulse/agents/content-generation/Dockerfile",
    image: "agent-content-generation",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_CONTENT_GENERATION",
  },
  "article-analysis": {
    service: "article-analysis",
    dockerfile: "apps/mediapulse/agents/article-analysis/Dockerfile",
    image: "agent-article-analysis",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_ARTICLE_ANALYSIS",
  },
  "query-analysis": {
    service: "query-analysis",
    dockerfile: "apps/mediapulse/agents/query-analysis/Dockerfile",
    image: "agent-query-analysis",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_QUERY_ANALYSIS",
  },
  delivery: {
    service: "delivery",
    dockerfile: "apps/mediapulse/agents/delivery/Dockerfile",
    image: "agent-delivery",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_DELIVERY",
  },
  "ticker-echo": {
    service: "ticker-echo",
    dockerfile: "apps/mediapulse/agents/ticker-echo/Dockerfile",
    image: "agent-ticker-echo",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_TICKER_ECHO",
  },
  "agent-user-registration": {
    service: "agent-user-registration",
    dockerfile: "apps/mediapulse/agents/user-registration/Dockerfile",
    image: "agent-user-registration",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_USER_REGISTRATION",
  },
  "agent-newsletter-feedback": {
    service: "agent-newsletter-feedback",
    dockerfile: "apps/mediapulse/agents/newsletter-feedback/Dockerfile",
    image: "agent-newsletter-feedback",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_NEWSLETTER_FEEDBACK",
  },
  "knowledge-ingestion": {
    service: "knowledge-ingestion",
    dockerfile: "apps/mediapulse/agents/knowledge-ingestion/Dockerfile",
    image: "agent-knowledge-ingestion",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_KNOWLEDGE_INGESTION",
  },
  "page-collection": {
    service: "page-collection",
    dockerfile: "apps/mediapulse/agents/page-collection/Dockerfile",
    image: "agent-page-collection",
    webhook_secret: "COOLIFY_WEBHOOK_AGENT_PAGE_COLLECTION",
  },
};

/**
 * Returns true when a path is treated as docs-only for heavy CI jobs.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export const isDocsOnlyHeavyJobPath = (filePath) => {
  if (filePath.startsWith("dev-docs/")) return true;
  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) return true;
  if (filePath.startsWith(".github/") && filePath.endsWith(".md")) return true;
  if (filePath.startsWith(".cursor/")) return true;
  if (filePath.startsWith("scripts/")) return true;
  if (filePath === "turbo.json") return true;
  if (filePath.startsWith("turbo/")) return true;
  return false;
};

/**
 * Returns true when a path is allowed in a CI-infra-only PR (with package.json).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export const isCiInfraOnlyPath = (filePath) => {
  if (isDocsOnlyHeavyJobPath(filePath)) return true;
  if (filePath.startsWith(".github/")) return true;
  if (filePath === "package.json") return true;
  return false;
};

/**
 * Returns true when a shared monorepo change should rebuild all Docker images.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export const isSharedDockerChangePath = (filePath) => {
  if (filePath.startsWith("packages/")) return true;
  if (filePath === "pnpm-lock.yaml") return true;
  if (filePath === "pnpm-workspace.yaml") return true;
  if (filePath === "turbo.json") return true;
  return false;
};

/**
 * Returns true when Prisma schema drift checks should run.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export const isPrismaDriftPath = (filePath) => {
  if (filePath.startsWith("packages/mediapulse/database/")) return true;
  if (filePath.startsWith("packages/hermes/orchestration-database/"))
    return true;
  return false;
};

/**
 * Maps an app path to a Docker service name, if any.
 *
 * @param {string} filePath
 * @returns {string | null}
 */
export const mapFilePathToDockerService = (filePath) => {
  const rules = [
    ["apps/mediapulse/user-registration/", "user-registration"],
    ["apps/mediapulse/domain-api/", "domain-api"],
    ["apps/mediapulse/agent-data-api/", "agent-data-api"],
    ["apps/hermes/agent-auth-api/", "agent-auth-api"],
    ["apps/hermes/agent-registry-api/", "agent-registry-api"],
    ["apps/hermes/dashboard/", "hermes"],
    ["apps/hermes/worker/", "hermes-worker"],
    ["apps/mediapulse/agents/data-collection/", "data-collection"],
    ["apps/mediapulse/agents/content-generation/", "content-generation"],
    ["apps/mediapulse/agents/delivery/", "delivery"],
    ["apps/mediapulse/agents/ticker-echo/", "ticker-echo"],
    ["apps/mediapulse/agents/article-analysis/", "article-analysis"],
    ["apps/mediapulse/agents/query-analysis/", "query-analysis"],
    ["apps/mediapulse/agents/user-registration/", "agent-user-registration"],
    [
      "apps/mediapulse/agents/newsletter-feedback/",
      "agent-newsletter-feedback",
    ],
    ["apps/mediapulse/agents/page-collection/", "page-collection"],
    ["apps/mediapulse/agents/knowledge-ingestion/", "knowledge-ingestion"],
  ];

  for (const [prefix, service] of rules) {
    if (filePath.startsWith(prefix)) return service;
  }

  return null;
};

/**
 * Resolves deploy services for a workflow subset.
 *
 * @param {DeployWorkflow} workflow
 * @returns {string[]}
 */
export const servicesForDeployWorkflow = (workflow) => {
  if (workflow === "app") return [...APP_DEPLOY_SERVICES];
  if (workflow === "agent") return [...AGENT_DEPLOY_SERVICES];
  return [...ALL_DOCKER_SERVICES];
};

/**
 * Detects Docker services that should build from changed file paths.
 *
 * @param {string[]} changedFiles
 * @param {DeployWorkflow} [workflow]
 * @returns {string[]}
 */
export const detectDockerServices = (changedFiles, workflow = "all") => {
  if (changedFiles.length === 0) return [];

  if (changedFiles.some(isSharedDockerChangePath)) {
    return servicesForDeployWorkflow(workflow).sort((a, b) =>
      a.localeCompare(b),
    );
  }

  const services = new Set();
  for (const filePath of changedFiles) {
    const service = mapFilePathToDockerService(filePath);
    if (service) services.add(service);
  }

  const allowed = new Set(servicesForDeployWorkflow(workflow));
  return [...services]
    .filter((service) => allowed.has(service))
    .sort((a, b) => a.localeCompare(b));
};

/**
 * Builds deploy matrix JSON objects for changed services.
 *
 * @param {string[]} services
 * @returns {ServiceDeployConfig[]}
 */
export const buildDeployMatrix = (services) =>
  services.map((service) => {
    const config = SERVICE_DEPLOY_CONFIG[service];
    if (!config) {
      throw new Error(`detect-pr-changes: unknown service "${service}"`);
    }
    return config;
  });

/**
 * Classifies changed files into CI scopes and job flags.
 *
 * @param {{ changedFiles: string[], eventName: CiEventName, baseSha?: string, headSha?: string }} input
 * @returns {{
 *   changeScope: ChangeScope,
 *   runCodeQuality: boolean,
 *   turboScope: ChangeScope,
 *   runCursorReview: boolean,
 *   runAiReview: boolean,
 *   runPrismaDrift: boolean,
 *   dockerServices: string[],
 *   dockerAny: boolean,
 *   turboBaseSha: string,
 *   turboHeadSha: string,
 * }}
 */
export const detectPrChanges = ({
  changedFiles,
  eventName,
  baseSha = "",
  headSha = "",
}) => {
  const emptySha = "0000000000000000000000000000000000000000";
  const safeBase = baseSha === emptySha ? "" : baseSha;

  if (eventName === "workflow_dispatch") {
    return {
      changeScope: "full",
      runCodeQuality: true,
      turboScope: "full",
      runCursorReview: true,
      runAiReview: true,
      runPrismaDrift: true,
      dockerServices: [...ALL_DOCKER_SERVICES],
      dockerAny: true,
      turboBaseSha: "",
      turboHeadSha: "",
    };
  }

  if (!safeBase || !headSha || changedFiles.length === 0) {
    const dockerServices = detectDockerServices(changedFiles);
    return {
      changeScope: "full",
      runCodeQuality: true,
      turboScope: "full",
      runCursorReview: true,
      runAiReview: true,
      runPrismaDrift: true,
      dockerServices,
      dockerAny: dockerServices.length > 0,
      turboBaseSha: safeBase,
      turboHeadSha: headSha,
    };
  }

  const runCodeQuality = changedFiles.some(
    (filePath) => !isDocsOnlyHeavyJobPath(filePath),
  );

  if (!runCodeQuality) {
    return {
      changeScope: "docs_only",
      runCodeQuality: false,
      turboScope: "docs_only",
      runCursorReview: false,
      runAiReview: false,
      runPrismaDrift: false,
      dockerServices: [],
      dockerAny: false,
      turboBaseSha: safeBase,
      turboHeadSha: headSha,
    };
  }

  const lockfileChanged = changedFiles.includes("pnpm-lock.yaml");
  const ciInfraOnly =
    !lockfileChanged &&
    changedFiles.every((filePath) => isCiInfraOnlyPath(filePath));

  const turboScope =
    eventName === "pull_request"
      ? ciInfraOnly
        ? "ci_infra"
        : "affected"
      : "full";

  const dockerServices = detectDockerServices(changedFiles);
  const runPrismaDrift = changedFiles.some(isPrismaDriftPath);

  return {
    changeScope: turboScope,
    runCodeQuality: true,
    turboScope,
    runCursorReview: true,
    runAiReview: true,
    runPrismaDrift,
    dockerServices,
    dockerAny: dockerServices.length > 0,
    turboBaseSha: safeBase,
    turboHeadSha: headSha,
  };
};
