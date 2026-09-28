import { describe, expect, it } from "vitest";

import {
  AGENT_DEPLOY_SERVICES,
  ALL_DOCKER_SERVICES,
  APP_DEPLOY_SERVICES,
  buildDeployMatrix,
  detectDockerServices,
  detectPrChanges,
  isPrismaDriftPath,
  mapFilePathToDockerService,
  selectDeployServices,
} from "./detect-pr-changes.mjs";

describe("mapFilePathToDockerService", () => {
  it("maps Hermes dashboard paths to hermes", () => {
    // Act
    const service = mapFilePathToDockerService(
      "apps/hermes/dashboard/app/page.tsx",
    );

    // Assert
    expect(service).toBe("hermes");
  });
});

describe("isPrismaDriftPath", () => {
  it("matches mediapulse database schema paths", () => {
    // Act
    const matches = isPrismaDriftPath(
      "packages/mediapulse/database/prisma/schema.prisma",
    );

    // Assert
    expect(matches).toBe(true);
  });
});

describe("detectDockerServices", () => {
  it("returns only hermes when dashboard files change", () => {
    // Setup
    const changedFiles = ["apps/hermes/dashboard/components/foo.tsx"];

    // Act
    const services = detectDockerServices(changedFiles);

    // Assert
    expect(services).toEqual(["hermes"]);
  });

  it("returns all app services when shared packages change in app workflow", () => {
    // Setup
    const changedFiles = ["packages/hermes/env/src/index.ts"];

    // Act
    const services = detectDockerServices(changedFiles, "app");

    // Assert
    expect(services).toEqual(
      [...APP_DEPLOY_SERVICES].sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe("detectPrChanges", () => {
  it("skips heavy jobs and reviews for docs-only PRs", () => {
    // Setup
    const changedFiles = ["dev-docs/docs/guide/development.mdx", "README.md"];

    // Act
    const result = detectPrChanges({
      changedFiles,
      eventName: "pull_request",
      baseSha: "base",
      headSha: "head",
    });

    // Assert
    expect(result.changeScope).toBe("docs_only");
    expect(result.runCodeQuality).toBe(false);
    expect(result.runCursorReview).toBe(false);
    expect(result.runAiReview).toBe(false);
    expect(result.runPrismaDrift).toBe(false);
    expect(result.dockerAny).toBe(false);
  });

  it("uses ci_infra scope for workflow-only PRs", () => {
    // Setup
    const changedFiles = [".github/workflows/code-quality.yml"];

    // Act
    const result = detectPrChanges({
      changedFiles,
      eventName: "pull_request",
      baseSha: "base",
      headSha: "head",
    });

    // Assert
    expect(result.turboScope).toBe("ci_infra");
    expect(result.runCodeQuality).toBe(true);
    expect(result.runPrismaDrift).toBe(false);
    expect(result.dockerAny).toBe(false);
  });

  it("uses affected scope and skips prisma drift for single-app PRs", () => {
    // Setup
    const changedFiles = ["apps/hermes/dashboard/lib/foo.ts"];

    // Act
    const result = detectPrChanges({
      changedFiles,
      eventName: "pull_request",
      baseSha: "base",
      headSha: "head",
    });

    // Assert
    expect(result.turboScope).toBe("affected");
    expect(result.runPrismaDrift).toBe(false);
    expect(result.dockerServices).toEqual(["hermes"]);
    expect(result.runCursorReview).toBe(true);
  });

  it("runs prisma drift when database schema changes", () => {
    // Setup
    const changedFiles = [
      "packages/mediapulse/database/prisma/schema.prisma",
      "apps/mediapulse/domain-api/src/index.ts",
    ];

    // Act
    const result = detectPrChanges({
      changedFiles,
      eventName: "pull_request",
      baseSha: "base",
      headSha: "head",
    });

    // Assert
    expect(result.runPrismaDrift).toBe(true);
    expect(result.turboScope).toBe("affected");
  });

  it("runs everything on workflow_dispatch", () => {
    // Act
    const result = detectPrChanges({
      changedFiles: ["README.md"],
      eventName: "workflow_dispatch",
      baseSha: "",
      headSha: "",
    });

    // Assert
    expect(result.turboScope).toBe("full");
    expect(result.runCodeQuality).toBe(true);
    expect(result.runPrismaDrift).toBe(true);
    expect(result.dockerAny).toBe(true);
  });
});

describe("selectDeployServices", () => {
  it("uses the diff when a base commit is given", () => {
    // Act
    const services = selectDeployServices({
      changedFiles: ["apps/hermes/dashboard/app/page.tsx"],
      workflow: "all",
      baseSha: "base",
    });

    // Assert
    expect(services).toEqual(["hermes"]);
  });

  it("selects every service without a base commit", () => {
    // Act
    const services = selectDeployServices({
      changedFiles: [],
      workflow: "all",
      baseSha: "",
    });

    // Assert
    expect(services).toEqual(ALL_DOCKER_SERVICES);
  });

  it("returns exactly the requested services and ignores the diff", () => {
    // Act
    const services = selectDeployServices({
      changedFiles: ["packages/hermes/env/src/index.ts"],
      workflow: "all",
      baseSha: "base",
      requestedServices: ["hermes", "ticker-echo"],
    });

    // Assert
    expect([...services].sort()).toEqual(["hermes", "ticker-echo"]);
  });

  it("rejects services outside the workflow", () => {
    // Act & Assert
    expect(() =>
      selectDeployServices({
        changedFiles: [],
        workflow: "agent",
        baseSha: "",
        requestedServices: ["hermes"],
      }),
    ).toThrow("unknown service(s): hermes");
  });
});

describe("buildDeployMatrix", () => {
  it("gives every deployable service a webhook env name", () => {
    // Act
    const matrix = buildDeployMatrix([
      ...APP_DEPLOY_SERVICES,
      ...AGENT_DEPLOY_SERVICES,
    ]);

    // Assert
    for (const entry of matrix) {
      expect(entry.webhook_env).toMatch(/^DEPLOY_WEBHOOK_(APP|AGENT)_[A-Z_]+$/);
    }
    expect(new Set(matrix.map((entry) => entry.webhook_env)).size).toBe(
      matrix.length,
    );
  });
});
