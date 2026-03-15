import { vi } from "vitest";

vi.mock("@workspace/env", () => ({
  env: {
    LOG_LEVEL: "info",
    OTEL_SERVICE_NAME: "test-service",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
    TEMP_ADMIN_USERNAME: "admin",
    TEMP_ADMIN_PASSWORD: "password",
  },
}));
